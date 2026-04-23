import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";
import { PLAN_PRICES } from "../../domain/plan-prices";

export interface DLocalGoWebhookPayload {
  id?: string;
  payment_id?: string;
  order_id?: string;
  status?: string;
}

const GRACE_PERIOD_DAYS = 7;

export class HandleWebhookUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(payload: DLocalGoWebhookPayload): Promise<void> {
    const paymentId = this.getPaymentId(payload);
    const orderId = this.getOrderId(payload);
    const status = this.normalizeStatus(payload.status);

    logger.info("Webhook dLocal Go recibido", {
      paymentId,
      orderId,
      rawStatus: payload.status,
      status,
    });

    switch (status) {
      case "PAID":       await this.handlePaymentPaid(payload);      break;
      case "PENDING":    logger.info("Pago dLocal todavía pendiente", { paymentId, orderId }); break;
      case "REJECTED":
      case "EXPIRED":    await this.handlePaymentFailed(payload);    break;
      case "CANCELLED":  await this.handlePaymentCancelled(payload); break;
      case "REFUNDED":   await this.handlePaymentRefunded(payload);  break;
      default:           logger.warn("Evento dLocal Go no manejado", { status });
    }
  }

  private async handlePaymentPaid(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;
    const paymentId = this.getPaymentId(payload);

    const previousActive = await this.subscriptionRepository.findActiveByBusinessId(
      subscription.business_id,
    );

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    // dlocal_subscription_id conserva el order_id original (identificador de la suscripción
    // recurrente en dLocal). Solo actualizamos dlocal_payment_id con el ID del cobro puntual.
    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_payment_id:    paymentId,
      current_period_start: now.toISOString(),
      current_period_end:   nextPeriodEnd.toISOString(),
      grace_period_ends_at: null,
    });

    if (previousActive && previousActive.id !== subscription.id) {
      await this.subscriptionRepository.updateStatus(previousActive.id, "canceled", {
        canceled_at: now.toISOString(),
      });
    }

    const business = await this.businessRepository.findById(subscription.business_id);
    if (
      business &&
      (business.plan !== subscription.plan || business.trial_ends_at !== null || business.subscription_downgraded_at !== null)
    ) {
      await this.businessRepository.update(subscription.business_id, {
        plan: subscription.plan,
        trial_ends_at: null,
        subscription_downgraded_at: null,
      });
    }

    this.fireAndForget(() =>
      this.emailService.sendPaymentConfirmation({
        to:              business?.email ?? "",
        negocioNombre:   business?.nombre ?? "",
        plan:            subscription.plan,
        amount:          PLAN_PRICES[subscription.plan] ?? 0,
        currency:        "UYU",
        nextBillingDate: nextPeriodEnd.toISOString(),
      }),
    );
  }

  private async handlePaymentFailed(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;
    const paymentId = this.getPaymentId(payload);
    if (subscription.status === "pending") {
      await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
        dlocal_payment_id: paymentId,
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
      dlocal_payment_id:    paymentId,
      grace_period_ends_at: gracePeriodEndsAt,
    });

    const business = await this.businessRepository.findById(subscription.business_id);

    if (newStatus === "grace_period") {
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailedGrace({
          to:                business?.email ?? "",
          negocioNombre:     business?.nombre ?? "",
          plan:              subscription.plan,
          gracePeriodEndsAt: gracePeriodEndsAt ?? "",
        }),
      );
    } else {
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailed({
          to:            business?.email ?? "",
          negocioNombre: business?.nombre ?? "",
          plan:          subscription.plan,
        }),
      );
    }
  }

  private async handlePaymentCancelled(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;
    await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
      canceled_at: new Date().toISOString(),
    });
  }

  private async handlePaymentRefunded(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const now = new Date().toISOString();

    // Reembolso en checkout no completado: simplemente cancelar
    if (subscription.status === "pending") {
      await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
        canceled_at: now,
      });
      return;
    }

    // Reembolso intencional (iniciado desde el panel de soporte o via refund explícito):
    // cancelar de inmediato sin período de gracia y degradar el negocio.
    await this.subscriptionRepository.updateStatus(subscription.id, "expired", {
      canceled_at: now,
    });

    await this.businessRepository.update(subscription.business_id, {
      plan: "starter",
      subscription_downgraded_at: now,
    });

    const business = await this.businessRepository.findById(subscription.business_id);
    this.fireAndForget(() =>
      this.emailService.sendPaymentFailedGrace({
        to:                business?.email ?? "",
        negocioNombre:     business?.nombre ?? "",
        plan:              subscription.plan,
        gracePeriodEndsAt: now,
      }),
    );

    logger.info("Suscripción expirada por reembolso", {
      subscriptionId: subscription.id,
      businessId: subscription.business_id,
    });
  }

  // ── Búsqueda de suscripción ───────────────────────────────────────────────

  private async findSubscription(
    payload: DLocalGoWebhookPayload,
  ): Promise<Subscription | null> {
    const orderId = this.getOrderId(payload);
    const paymentId = this.getPaymentId(payload);

    // 1. order_id provisional guardado al crear el checkout
    let sub = orderId
      ? await this.subscriptionRepository.findByDlocalId(orderId)
      : null;
    if (sub) return sub;

    // 2. Por payment_id ya conciliado previamente
    sub = await this.subscriptionRepository.findByPaymentId(paymentId);
    if (sub) return sub;

    // 3. Por businessId embebido en order_id (formato uuid_timestamp)
    if (orderId) {
      const businessId = orderId.split("_")[0];
      if (businessId) {
        sub = await this.subscriptionRepository.findPendingByBusinessId(businessId);
        if (sub) return sub;
      }
    }

    // 4. Fallback: dLocal Go no siempre envía order_id en el primer webhook.
    //    Solo se usa si el order_id permite extraer un businessId — nunca sin restricción
    //    de negocio para evitar asignar el webhook al checkout de otro negocio.
    const businessIdFromOrder = orderId ? orderId.split("_")[0] : undefined;
    if (!businessIdFromOrder) {
      logger.warn("Suscripción no encontrada para webhook (sin order_id para acotar búsqueda)", {
        paymentId,
        orderId,
      });
      return null;
    }

    const recent = await this.subscriptionRepository.findMostRecentPending(businessIdFromOrder);
    if (recent) {
      logger.info("Suscripción encontrada por fallback (acotado por businessId)", {
        subscriptionId: recent.id,
        paymentId,
        businessIdFromOrder,
      });
      return recent;
    }

    logger.warn("Suscripción no encontrada para webhook", {
      paymentId,
      orderId,
    });
    return null;
  }

  private getPaymentId(payload: DLocalGoWebhookPayload): string {
    return payload.payment_id ?? payload.id ?? "";
  }

  private getOrderId(payload: DLocalGoWebhookPayload): string | undefined {
    return payload.order_id;
  }

  private normalizeStatus(status?: string): string {
    switch ((status ?? "PAID").toUpperCase()) {
      case "APPROVED":
      case "PAID":
      case "AUTHORIZED":
      case "VERIFIED":
        return "PAID";
      case "PENDING":
      case "IN_PROGRESS":
        return "PENDING";
      case "REJECTED":
      case "FAILED":
      case "DECLINED":
        return "REJECTED";
      case "CANCELLED":
      case "CANCELED":
        return "CANCELLED";
      case "EXPIRED":
        return "EXPIRED";
      case "REFUNDED":
        return "REFUNDED";
      default:
        return (status ?? "PAID").toUpperCase();
    }
  }

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
