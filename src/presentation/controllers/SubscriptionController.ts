import { Request, Response, NextFunction } from "express";
import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IPaymentProvider } from "../../application/ports/IPaymentProvider";
import { CreateSubscriptionUseCase } from "../../application/subscriptions/CreateSubscriptionUseCase";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { AppError, NotFoundError } from "../../domain/errors";
import { CreateSubscriptionInput } from "../schemas/subscription.schema";
import { logger } from "../../infrastructure/logger";

export class SubscriptionController {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly paymentProvider: IPaymentProvider,
    private readonly createSubscriptionUseCase: CreateSubscriptionUseCase,
    private readonly userRepository: IUserRepository,
    private readonly businessRepository: IBusinessRepository,
  ) {}

/** GET /api/subscriptions — estado actual de la suscripción */
get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeSubscription = await this.subscriptionRepository.findCurrentEffectiveByBusinessId(
      req.businessId!,
    );

    const pendingSubscription = await this.subscriptionRepository.findPendingByBusinessId(
      req.businessId!,
    );

    // Bug 1 fix: findPendingByBusinessId ya garantiza que el status es uno de
    // ["pending", "processing", "waiting_payment"] — no hace falta re-filtrar aquí.
    // Bug 6 fix: se eliminó el campo duplicado `subscription`.
    // Bug 5 fix: se expone effectivePlan como fuente de verdad para el frontend
    // en lugar de depender de business.plan (que puede quedar desincronizado si
    // el cron de degradación falla).
    const effectivePlan = activeSubscription?.plan ?? "starter";

    res.json({
      activeSubscription,
      pendingSubscription,
      effectivePlan,
      planSource: activeSubscription ? "subscription" : "fallback",
    });
  } catch (error) {
    next(error);
  }
};
  /** POST /api/subscriptions — iniciar checkout */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan, firstName, lastName, email } = req.body as CreateSubscriptionInput;

      const user = await this.userRepository.findById(req.userId!);
      if (!user) throw new NotFoundError("Usuario");

      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      const { checkoutUrl } = await this.createSubscriptionUseCase.execute({
        businessId: req.businessId!,
        plan,
        email,
        firstName,
        lastName,
        frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:4200",
      });

      res.json({ checkoutUrl });
    } catch (error) {
      next(error);
    }
  };

/** POST /api/subscriptions/cancel */
cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subscription = await this.subscriptionRepository.findActiveByBusinessId(
      req.businessId!,
    );

    if (!subscription) throw new NotFoundError("Suscripción");

    if (subscription.status === "canceled") {
      throw new AppError("La suscripción ya está cancelada", 400);
    }

    if (!subscription.dlocal_subscription_id) {
      throw new AppError("Falta ID de suscripción en proveedor", 400);
    }

    // Bug 4 fix: el comentario anterior decía "Usamos dlocal_payment_id" pero el código
    // usaba (correctamente) dlocal_subscription_id. Se corrige el comentario para evitar
    // que alguien "arregle" el código para que coincida con la documentación incorrecta.
    // dlocal_subscription_id = ID de la suscripción recurrente en dLocal Go.
    // dlocal_payment_id = ID del último cobro puntual (endpoint diferente, no usar aquí).
    await this.paymentProvider.cancelSubscription(subscription.dlocal_subscription_id);

    await this.subscriptionRepository.updateStatus(
      subscription.id,
      "canceled",
      { canceled_at: new Date().toISOString() },
    );

    res.json({
      message: "Suscripción cancelada. Tu plan se mantiene activo hasta el fin del período.",
      currentPeriodEnd: subscription.current_period_end ?? undefined,
    });
  } catch (error) {
    next(error);
  }
};


  /** POST /api/subscriptions/refund — reembolsar y cancelar de inmediato (uso administrativo)
   *
   * A diferencia de /cancel, el refund termina el acceso en el momento:
   * no se espera a current_period_end. Se usa ante errores de cobro doble,
   * cambio de plan con error, o decisión de soporte.
   *
   * El webhook REFUNDED de dLocal ejecutará la degradación del plan. */
  refund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription = await this.subscriptionRepository.findActiveByBusinessId(
        req.businessId!,
      );

      if (!subscription) throw new NotFoundError("Suscripción activa");

      if (!subscription.dlocal_payment_id) {
        throw new AppError("No hay un pago confirmado para reembolsar en esta suscripción", 400);
      }

      if (subscription.status === "canceled" || subscription.status === "expired") {
        throw new AppError("La suscripción ya está cancelada o expirada", 400);
      }

      logger.info("Iniciando reembolso de suscripción", {
        businessId: req.businessId,
        subscriptionId: subscription.id,
        paymentId: subscription.dlocal_payment_id,
      });

      // 1. Solicitar el reembolso en dLocal — esto dispara el webhook REFUNDED
      //    que a su vez completa la degradación del negocio.
      await this.paymentProvider.refundPayment(subscription.dlocal_payment_id);

      res.json({
        message: "Reembolso solicitado. El acceso al plan será revocado de inmediato.",
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/subscriptions/history — historial de pagos via dLocal */
  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription = await this.subscriptionRepository.findCurrentEffectiveByBusinessId(
        req.businessId!,
      );

      if (!subscription) {
        res.json({ payments: [] });
        return;
      }

      if (!subscription.dlocal_subscription_id) {
        throw new AppError("Falta ID de suscripción en proveedor", 400);
      }
      const details = await this.paymentProvider.getSubscription(
        subscription.dlocal_subscription_id,
      );
      res.json({
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          gracePeriodEndsAt: subscription.grace_period_ends_at,
          nextBillingDate: details.nextBillingDate,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
