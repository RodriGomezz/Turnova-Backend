import { ISubscriptionRepository }       from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository }            from "../../domain/interfaces/IBusinessRepository";
import { IEmailService }                  from "../ports/IEmailService";
import { IPaymentProvider, PaymentDetails } from "../ports/IPaymentProvider";
import { Subscription, SubscriptionStatus, BillingCycle } from "../../domain/entities/Subscription";
import { logger }                         from "../../infrastructure/logger";
import { PLAN_PRICES_MONTHLY, PLAN_PRICES_ANNUAL } from "../../domain/plan-prices";
import { updateBusinessNetwork, findNetworkBusinessIds } from "../../infrastructure/database/business-network";
import { PLAN_LIMITS }                    from "../../domain/plan-limits";
import { SseService }                     from "../../infrastructure/sse/sse.service";

/**
 * Payload que dLocal Go envía al notification_url.
 *
 * Según la documentación oficial de dLocal Go, el webhook solo contiene
 * el identificador del pago — no el estado ni el payload completo:
 *
 *   POST [notification_url]
 *   { "payment_id": "[Payment Id]" }
 *
 * Tras recibirlo, consultamos GET /v1/payments/:id para obtener el estado real.
 */
export interface DLocalGoWebhookPayload {
  payment_id?: string;
}

const GRACE_PERIOD_DAYS = 7;

export class HandleWebhookUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository:     IBusinessRepository,
    private readonly emailService:           IEmailService,
    private readonly paymentProvider:        IPaymentProvider,
  ) {}

  async execute(payload: DLocalGoWebhookPayload): Promise<void> {
    const paymentId = payload.payment_id;

    if (!paymentId) {
      logger.warn("Webhook dLocal Go sin payment_id — ignorado", {
        keys: Object.keys(payload),
      });
      return;
    }

    logger.info("Webhook dLocal Go recibido", { paymentId });

    // dLocal Go solo envía el ID. Consultamos el estado real del pago.
    let payment: PaymentDetails;
    try {
      payment = await this.paymentProvider.getPayment(paymentId);
    } catch (err) {
      logger.error("No se pudo obtener el pago de dLocal Go", { paymentId, err });
      // Lanzar para que Express devuelva non-200 y dLocal Go reintente.
      throw err;
    }

    logger.info("Pago dLocal Go obtenido", {
      paymentId,
      status:            payment.status,
      orderId:           payment.orderId,
      subscriptionToken: payment.subscriptionToken,
      externalId:        payment.externalId,
    });

    const status = (payment.status ?? "").toUpperCase().trim();

    switch (status) {
      case "COMPLETED":
        await this.handlePaymentSuccess(payment);
        break;

      case "DECLINED":
      case "FAILED":
      case "REJECTED":
        await this.handleExecutionDeclined(payment);
        break;

      case "CANCELLED":
      case "CANCELED":
        await this.handleSubscriptionCancelled(payment);
        break;

      case "PENDING":
        // dLocal Go notifica PENDING mientras el pago está procesando.
        // No actuar — esperamos COMPLETED o DECLINED.
        logger.info("Webhook dLocal Go PENDING — sin acción", {
          paymentId,
          orderId: payment.orderId,
        });
        break;

      default:
        logger.warn("Webhook dLocal Go estado desconocido — ignorado", {
          status,
          paymentId,
        });
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handlePaymentSuccess(payment: PaymentDetails): Promise<void> {
    const subscription = await this.findSubscription(payment);
    if (!subscription) return;

    const now           = new Date();
    const nextPeriodEnd = new Date(now);
    const cycle: BillingCycle = subscription.billing_cycle ?? "monthly";

    if (cycle === "annual") {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
      nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);
    }

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_subscription_token: payment.subscriptionToken ?? subscription.dlocal_subscription_token,
      dlocal_last_execution_id:  payment.orderId           ?? subscription.dlocal_last_execution_id,
      payer_email:               payment.clientEmail       ?? subscription.payer_email,
      current_period_start:      now.toISOString(),
      current_period_end:        nextPeriodEnd.toISOString(),
      grace_period_ends_at:      null,
    });

    const business = await this.businessRepository.findById(subscription.business_id);

    if (business) {
      const needsUpdate =
        business.plan !== subscription.plan         ||
        business.trial_ends_at !== null              ||
        business.subscription_downgraded_at !== null;

      if (needsUpdate) {
        if (subscription.plan === "business") {
          await updateBusinessNetwork(subscription.business_id, {
            plan:                        "business",
            trial_ends_at:               null,
            subscription_downgraded_at:  null,
          });
        } else {
          await this.businessRepository.update(subscription.business_id, {
            plan:                        subscription.plan,
            trial_ends_at:               null,
            subscription_downgraded_at:  null,
          });
          await this.enforceMultiSucursalLimit(
            subscription.business_id,
            subscription.plan,
          );
        }
      }
    }

    // Notificar al frontend via SSE si está escuchando
    SseService.notifyPaymentConfirmed(subscription.business_id);

    const planPrice =
      cycle === "annual"
        ? PLAN_PRICES_ANNUAL[subscription.plan]  ?? 0
        : PLAN_PRICES_MONTHLY[subscription.plan] ?? 0;

    this.fireAndForget(() =>
      this.emailService.sendPaymentConfirmation({
        to:              business?.email        ?? "",
        negocioNombre:   business?.nombre       ?? "",
        plan:            subscription.plan,
        amount:          planPrice,
        currency:        "UYU",
        nextBillingDate: nextPeriodEnd.toISOString(),
      }),
    );

    logger.info("Suscripción activada por pago exitoso", {
      subscriptionId: subscription.id,
      businessId:     subscription.business_id,
      plan:           subscription.plan,
      cycle,
      wasStatus:      subscription.status,
      paymentId:      payment.id,
    });
  }

  /**
   * Desactiva sucursales adicionales cuando el plan no incluye multi-sucursal.
   * [BUG-001] Cubre tanto primeras suscripciones como downgrades desde business.
   */
  private async enforceMultiSucursalLimit(
    seedBusinessId: string,
    newPlan:        string,
  ): Promise<void> {
    const limits = PLAN_LIMITS[newPlan];
    if (limits?.multiSucursal) return;

    const businessIds = await findNetworkBusinessIds(seedBusinessId);
    if (businessIds.length <= 1) return;

    const toDeactivate = businessIds.slice(1);
    for (const businessId of toDeactivate) {
      await this.businessRepository.update(businessId, { activo: false });
      logger.info("Sucursal desactivada por cambio a plan sin multi-sucursal", {
        businessId,
        newPlan,
        seedBusinessId,
      });
    }
  }

  private async handleExecutionDeclined(payment: PaymentDetails): Promise<void> {
    const subscription = await this.findSubscription(payment);
    if (!subscription) return;

    if (subscription.status === "pending") {
      await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
        canceled_at: new Date().toISOString(),
      });
      return;
    }

    if (subscription.status === "grace_period") return;

    const newStatus: SubscriptionStatus =
      subscription.status === "past_due" ? "grace_period" : "past_due";

    const gracePeriodEndsAt =
      newStatus === "grace_period"
        ? this.calcGracePeriodEnd(
            subscription.current_period_end ?? new Date().toISOString(),
          )
        : null;

    await this.subscriptionRepository.updateStatus(subscription.id, newStatus, {
      dlocal_last_execution_id: payment.orderId ?? null,
      grace_period_ends_at:     gracePeriodEndsAt,
    });

    const business = await this.businessRepository.findById(subscription.business_id);

    if (newStatus === "grace_period") {
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailedGrace({
          to:                business?.email    ?? "",
          negocioNombre:     business?.nombre   ?? "",
          plan:              subscription.plan,
          gracePeriodEndsAt: gracePeriodEndsAt  ?? "",
        }),
      );
    } else {
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailed({
          to:            business?.email  ?? "",
          negocioNombre: business?.nombre ?? "",
          plan:          subscription.plan,
        }),
      );
    }
  }

  private async handleSubscriptionCancelled(payment: PaymentDetails): Promise<void> {
    const subscription = await this.findSubscription(payment);
    if (!subscription) return;

    await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
      canceled_at: new Date().toISOString(),
    });

    logger.info("Suscripción cancelada por webhook de dLocal Go", {
      subscriptionId: subscription.id,
      businessId:     subscription.business_id,
    });
  }

  // ── Búsqueda de suscripción ───────────────────────────────────────────────
  //
  // Orden de prioridad:
  // 1. external_id → nuestro ID interno enviado al crear el checkout
  // 2. subscription_token → token de la suscripción en dLocal Go
  // 3. plan_token → token del plan (fallback para primer pago sin sub token)
  // 4. order_id → ID de la ejecución (último recurso)

  private async findSubscription(
    payment: PaymentDetails,
  ): Promise<Subscription | null> {
    if (payment.externalId) {
      const sub = await this.subscriptionRepository.findById(payment.externalId);
      if (sub) {
        logger.info("Suscripción encontrada por external_id", {
          externalId: payment.externalId,
        });
        return sub;
      }
    }

    if (payment.subscriptionToken) {
      const sub = await this.subscriptionRepository.findBySubscriptionToken(
        payment.subscriptionToken,
      );
      if (sub) return sub;
    }

    if (payment.planToken) {
      const sub = await this.subscriptionRepository.findByPlanToken(payment.planToken);
      if (sub) return sub;
    }

    if (payment.orderId) {
      const sub = await this.subscriptionRepository.findByExecutionId(payment.orderId);
      if (sub) return sub;
    }

    logger.warn("Suscripción no encontrada para pago de dLocal Go", {
      paymentId:         payment.id,
      externalId:        payment.externalId,
      subscriptionToken: payment.subscriptionToken,
      planToken:         payment.planToken,
      orderId:           payment.orderId,
    });
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private calcGracePeriodEnd(fromDate: string): string {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
    return d.toISOString();
  }

  private fireAndForget(fn: () => Promise<void>): void {
    fn().catch((err) =>
      logger.error("Error enviando email de suscripción", { err }),
    );
  }
}
