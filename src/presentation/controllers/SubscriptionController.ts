import { Request, Response, NextFunction } from "express";
import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IPaymentProvider } from "../../application/ports/IPaymentProvider";
import { CreateSubscriptionUseCase } from "../../application/subscriptions/CreateSubscriptionUseCase";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { AppError, NotFoundError } from "../../domain/errors";
import { CreateSubscriptionInput } from "../schemas/subscription.schema";

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

    const effectivePending =
      pendingSubscription && activeSubscription?.plan === pendingSubscription.plan && activeSubscription?.status === 'active'
        ? null
        : pendingSubscription;

    res.json({
      subscription: activeSubscription,
      activeSubscription,
      pendingSubscription: effectivePending,
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

  /** POST /api/subscriptions/cancel — cancelar suscripción
   * Usamos POST en lugar de DELETE porque algunos proxies/CDNs descartan el body en DELETE. */
  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription = await this.subscriptionRepository.findActiveByBusinessId(
        req.businessId!,
      );

      if (!subscription) throw new NotFoundError("Suscripción");

      if (subscription.status === "canceled") {
        throw new AppError("La suscripción ya está cancelada", 400);
      }

      // dlocal_subscription_id contiene el order_id provisional al crear el checkout.
      // dlocal_payment_id se actualiza con el ID real de dLocal cuando llega el webhook PAID.
      // Siempre usar el ID real para evitar un 404 al cancelar en dLocal.
      const dlocalId = subscription.dlocal_payment_id ?? subscription.dlocal_subscription_id;
      await this.paymentProvider.cancelSubscription(dlocalId);

      await this.subscriptionRepository.updateStatus(
        subscription.id,
        "canceled",
        { canceled_at: new Date().toISOString() },
      );

      // El plan se mantiene hasta que venza current_period_end — el cron lo degrada
      res.json({
        message: "Suscripción cancelada. Tu plan se mantiene activo hasta el fin del período.",
        currentPeriodEnd: subscription.current_period_end ?? undefined,
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
