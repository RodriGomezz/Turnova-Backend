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

  /** GET /api/subscriptions */
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activeSubscription =
        await this.subscriptionRepository.findCurrentEffectiveByBusinessId(
          req.businessId!,
        );
      const pendingSubscription =
        await this.subscriptionRepository.findPendingByBusinessId(req.businessId!);
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

  /**
   * POST /api/subscriptions/create
   * Devuelve subscribeUrl — el frontend redirige al usuario a esa URL.
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan, email } = req.body as CreateSubscriptionInput;

      const user = await this.userRepository.findById(req.userId!);
      if (!user) throw new NotFoundError("Usuario");

      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      const result = await this.createSubscriptionUseCase.execute({
        businessId: req.businessId!,
        plan,
        email,
      });

      logger.info("Checkout dLocal Go iniciado", {
        businessId: req.businessId,
        plan,
        subscriptionId: result.subscriptionId,
      });

      res.json({
        subscribeUrl: result.subscribeUrl,
        planToken:    result.planToken,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/subscriptions/cancel */
  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription =
        await this.subscriptionRepository.findActiveByBusinessId(req.businessId!);

      if (!subscription) throw new NotFoundError("Suscripción");

      if (subscription.status === "canceled") {
        throw new AppError("La suscripción ya está cancelada", 400);
      }

      if (
        subscription.dlocal_plan_id === null ||
        subscription.dlocal_subscription_id === null
      ) {
        // Checkout pendiente — cancelar solo localmente
        await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
          canceled_at: new Date().toISOString(),
        });
      } else {
        await this.paymentProvider.cancelSubscription(
          subscription.dlocal_plan_id,
          subscription.dlocal_subscription_id,
        );
        await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
          canceled_at: new Date().toISOString(),
        });
      }

      res.json({
        message:
          "Suscripción cancelada. Tu plan se mantiene activo hasta el fin del período.",
        currentPeriodEnd: subscription.current_period_end ?? undefined,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/subscriptions/history */
  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription =
        await this.subscriptionRepository.findCurrentEffectiveByBusinessId(
          req.businessId!,
        );

      if (!subscription) {
        res.json({ payments: [] });
        return;
      }

      res.json({
        subscription: {
          plan:              subscription.plan,
          status:            subscription.status,
          currentPeriodEnd:  subscription.current_period_end,
          gracePeriodEndsAt: subscription.grace_period_ends_at,
          nextBillingDate:   subscription.current_period_end,
          planToken:         subscription.dlocal_plan_token,
          subscriptionToken: subscription.dlocal_subscription_token,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}