import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";

// ── Tipos de eventos dLocal Go ────────────────────────────────────────────────
// dLocal Go envía el payment_id en el body del webhook via POST.
// El status del pago se consulta luego vía GET /v1/payments/:id

export interface DLocalGoWebhookPayload {
  /** ID del pago en dLocal Go */
  payment_id: string;
  /** order_id que enviamos al crear el pago (formato: businessId-timestamp) */
  order_id?: string;
  /** Estado del pago */
  status?: "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
}

/** Días de gracia antes de degradar el plan */
const GRACE_PERIOD_DAYS = 7;

// ── Use Case ──────────────────────────────────────────────────────────────────

export class HandleWebhookUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(payload: DLocalGoWebhookPayload): Promise<void> {
    logger.info("Webhook dLocal Go recibido", {
      paymentId: payload.payment_id,
      orderId:   payload.order_id,
      status:    payload.status,
    });

    const status = payload.status ?? "PAID";

    switch (status) {
      case "PAID":
        await this.handlePaymentPaid(payload);
        break;
      case "REJECTED":
      case "EXPIRED":
        await this.handlePaymentFailed(payload);
        break;
      case "CANCELLED":
        await this.handlePaymentCancelled(payload);
        break;
      case "REFUNDED":
        await this.handlePaymentRefunded(payload);
        break;
      default:
        logger.warn("Evento dLocal Go no manejado", { status });
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  private async handlePaymentPaid(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscriptionByOrderId(payload);
    if (!subscription) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_payment_id:    payload.payment_id,
      current_period_start: now.toISOString(),
      current_period_end:   nextPeriodEnd.toISOString(),
      grace_period_ends_at: null,
    });

    // Restaurar plan si estaba degradado
    const business = await this.businessRepository.findById(subscription.business_id);
    if (business && business.plan !== subscription.plan) {
      await this.businessRepository.update(subscription.business_id, {
        plan: subscription.plan,
      });
      logger.info("Plan restaurado tras pago", {
        businessId: subscription.business_id,
        plan:       subscription.plan,
      });
    }

    this.fireAndForget(() =>
      this.emailService.sendPaymentConfirmation({
        to:              business?.email ?? "",
        negocioNombre:   business?.nombre ?? "",
        plan:            subscription.plan,
        amount:          PLAN_PRICES_MAP[subscription.plan] ?? 0,
        currency:        "UYU",
        nextBillingDate: nextPeriodEnd.toISOString(),
      }),
    );
  }

  private async handlePaymentFailed(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscriptionByOrderId(payload);
    if (!subscription) return;

    if (subscription.status === "grace_period") return;

    const newStatus: SubscriptionStatus =
      subscription.status === "past_due" ? "grace_period" : "past_due";

    const gracePeriodEndsAt =
      newStatus === "grace_period"
        ? this.calcGracePeriodEnd(subscription.current_period_end)
        : null;

    await this.subscriptionRepository.updateStatus(subscription.id, newStatus, {
      dlocal_payment_id:    payload.payment_id,
      grace_period_ends_at: gracePeriodEndsAt,
    });

    const business = await this.businessRepository.findById(subscription.business_id);

    if (newStatus === "grace_period") {
      logger.warn("Suscripción en período de gracia", {
        businessId:          subscription.business_id,
        gracePeriodEndsAt,
      });
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailedGrace({
          to:                  business?.email ?? "",
          negocioNombre:       business?.nombre ?? "",
          plan:                subscription.plan,
          gracePeriodEndsAt:   gracePeriodEndsAt ?? "",
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
    const subscription = await this.findSubscriptionByOrderId(payload);
    if (!subscription) return;

    await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
      canceled_at: new Date().toISOString(),
    });

    logger.info("Suscripción cancelada via webhook", {
      businessId:       subscription.business_id,
      currentPeriodEnd: subscription.current_period_end,
    });
  }

  private async handlePaymentRefunded(payload: DLocalGoWebhookPayload): Promise<void> {
    const subscription = await this.findSubscriptionByOrderId(payload);
    if (!subscription) return;

    const gracePeriodEndsAt = this.calcGracePeriodEnd(new Date().toISOString());

    await this.subscriptionRepository.updateStatus(subscription.id, "grace_period", {
      grace_period_ends_at: gracePeriodEndsAt,
    });

    const business = await this.businessRepository.findById(subscription.business_id);

    logger.warn("Pago reembolsado", { businessId: subscription.business_id });

    this.fireAndForget(() =>
      this.emailService.sendPaymentFailedGrace({
        to:                business?.email ?? "",
        negocioNombre:     business?.nombre ?? "",
        plan:              subscription.plan,
        gracePeriodEndsAt,
      }),
    );
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  /**
   * dLocal Go identifica los pagos por order_id (que controlamos nosotros)
   * o por payment_id (que asigna dLocal Go).
   * Buscamos primero por dlocal_payment_id, luego por order_id.
   */
  private async findSubscriptionByOrderId(
    payload: DLocalGoWebhookPayload,
  ): Promise<Subscription | null> {
    // Intentar por payment_id primero (actualizaciones de pagos existentes)
    let subscription = await this.subscriptionRepository.findByDlocalId(
      payload.payment_id,
    );
    if (subscription) return subscription;

    // Fallback: buscar por order_id (formato: businessId-timestamp)
    if (payload.order_id) {
      const businessId = payload.order_id.split("-")[0];
      if (businessId) {
        subscription = await this.subscriptionRepository.findByBusinessId(businessId);
        if (subscription) return subscription;
      }
    }

    logger.warn("Suscripción no encontrada para webhook", {
      paymentId: payload.payment_id,
      orderId:   payload.order_id,
    });
    return null;
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

// Precios locales para emails — evita importar plan-prices en el use case
const PLAN_PRICES_MAP: Record<string, number> = {
  pro:      1390,
  business: 2290,
};
