import { Request, Response, NextFunction } from "express";
import { ISubscriptionRepository }          from "../../domain/interfaces/ISubscriptionRepository";
import { IPaymentProvider }                 from "../../application/ports/IPaymentProvider";
import { CreateSubscriptionUseCase }        from "../../application/subscriptions/CreateSubscriptionUseCase";
import { IUserRepository }                  from "../../domain/interfaces/IUserRepository";
import { IBusinessRepository }              from "../../domain/interfaces/IBusinessRepository";
import { AppError, NotFoundError }          from "../../domain/errors";
import { CreateSubscriptionInput }          from "../schemas/subscription.schema";
import { logger }                           from "../../infrastructure/logger";
import { SseService }                       from "../../infrastructure/sse/sse.service";

export class SubscriptionController {
  constructor(
    private readonly subscriptionRepository:   ISubscriptionRepository,
    private readonly paymentProvider:          IPaymentProvider,
    private readonly createSubscriptionUseCase: CreateSubscriptionUseCase,
    private readonly userRepository:           IUserRepository,
    private readonly businessRepository:       IBusinessRepository,
  ) {}

  /** GET /api/subscriptions */
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activeSubscription =
        await this.subscriptionRepository.findCurrentEffectiveByBusinessId(
          req.businessId!,
        );
      const pendingSubscriptionRaw =
        await this.subscriptionRepository.findPendingByBusinessId(req.businessId!);
      const pendingSubscription =
        activeSubscription?.status === "active" ? null : pendingSubscriptionRaw;
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
   * GET /api/subscriptions/confirm-stream
   *
   * Endpoint SSE — el frontend se conecta tras redirigir desde el checkout
   * de dLocal Go. Mantiene una conexión HTTP persistente y envía el evento
   * `payment_confirmed` en el momento exacto en que el webhook de dLocal Go
   * llega y la DB se actualiza, eliminando la latencia del polling.
   *
   * Arquitectura:
   *   Frontend ──── GET /confirm-stream ────► SSE connection abierta
   *   dLocal Go ──── POST /dlocal ──────────► HandleWebhookUseCase
   *                                              └── SseService.notifyPaymentConfirmed()
   *                                                     └── event: payment_confirmed ──► Frontend
   *
   * Fallback: si el frontend pierde la conexión SSE (red, proxy),
   * el polling existente en config.ts actúa como respaldo.
   *
   * Nota para escala horizontal: con múltiples instancias del servidor,
   * reemplazar SseService por Redis Pub/Sub para que el nodo que recibe
   * el webhook pueda notificar al nodo que tiene la conexión SSE.
   */
  confirmStream = (req: Request, res: Response): void => {
    const businessId = req.businessId!;

    // Verificar si el pago ya fue confirmado antes de abrir la conexión.
    // Evita SSE innecesarias cuando el usuario recarga /configuracion
    // con ?status=success pero el webhook ya llegó.
    this.subscriptionRepository
      .findCurrentEffectiveByBusinessId(businessId)
      .then((sub) => {
        if (sub?.status === "active") {
          // Pago ya confirmado — responder directamente sin abrir SSE
          res.setHeader("Content-Type",  "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection",    "keep-alive");
          res.flushHeaders();
          res.write('event: payment_confirmed\ndata: {"status":"active","cached":true}\n\n');
          res.end();
          logger.info("SSE: pago ya confirmado, respuesta inmediata", { businessId });
          return;
        }

        // Registrar la conexión SSE — SseService envía heartbeats y limpia al desconectar
        SseService.addClient(businessId, res);

        // Limpiar al cerrar la conexión (navegador cerrado, cambio de ruta, etc.)
        req.on("close", () => {
          SseService.removeClient(businessId);
        });
      })
      .catch((err) => {
        logger.error("SSE: error verificando estado previo de suscripción", {
          businessId,
          err,
        });
        // Abrir SSE de todas formas — el webhook confirmará si llega
        SseService.addClient(businessId, res);
        req.on("close", () => SseService.removeClient(businessId));
      });
  };

  /**
   * POST /api/subscriptions/create
   * Devuelve subscribeUrl y el frontend redirige al usuario a esa URL.
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
        businessId:     req.businessId,
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
        await this.subscriptionRepository.findActiveByBusinessId(req.businessId!) ??
        await this.subscriptionRepository.findPendingByBusinessId(req.businessId!);

      if (!subscription) throw new NotFoundError("Suscripción");

      if (subscription.status === "canceled") {
        throw new AppError("La suscripción ya está cancelada", 400);
      }

      if (
        subscription.dlocal_plan_id         === null ||
        subscription.dlocal_subscription_id === null
      ) {
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

      const message =
        subscription.status === "pending"
          ? "Cancelaste el checkout pendiente. Podés iniciar una nueva suscripción cuando quieras."
          : "Suscripción cancelada. Tu plan se mantiene activo hasta el fin del período.";

      res.json({
        message,
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
