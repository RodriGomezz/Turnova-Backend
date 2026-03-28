import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { AppError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";

// ── Tipos de eventos dLocal ───────────────────────────────────────────────────

export type DLocalEventType =
  | "PAYMENT_PAID"
  | "PAYMENT_FAILED"
  | "PAYMENT_REVERSED"
  | "CHARGEBACK"
  | "SUBSCRIPTION_CANCELED";

export interface DLocalWebhookPayload {
  id: string;
  type: DLocalEventType;
  data: {
    id: string;                    // payment_id
    subscription_id?: string;
    order_id?: string;
    status: string;
    amount?: number;
    currency?: string;
  };
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

  async execute(payload: DLocalWebhookPayload): Promise<void> {
    logger.info("Webhook dLocal recibido", {
      eventId: payload.id,
      type: payload.type,
      paymentId: payload.data.id,
      subscriptionId: payload.data.subscription_id,
    });

    switch (payload.type) {
      case "PAYMENT_PAID":
        await this.handlePaymentPaid(payload);
        break;
      case "PAYMENT_FAILED":
        await this.handlePaymentFailed(payload);
        break;
      case "PAYMENT_REVERSED":
      case "CHARGEBACK":
        await this.handlePaymentReversed(payload);
        break;
      case "SUBSCRIPTION_CANCELED":
        await this.handleSubscriptionCanceled(payload);
        break;
      default:
        logger.warn("Evento dLocal no manejado", { type: payload.type });
    }
  }

  // ── Handlers de eventos ───────────────────────────────────────────────────

  private async handlePaymentPaid(payload: DLocalWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(
      subscription.id,
      "active",
      {
        dlocal_payment_id: payload.data.id,
        current_period_start: now.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        grace_period_ends_at: null,
      },
    );

    // Restaurar plan si estaba degradado por gracia expirada
    const business = await this.businessRepository.findById(subscription.business_id);
    if (business && business.plan !== subscription.plan) {
      await this.businessRepository.update(subscription.business_id, {
        plan: subscription.plan,
      });
      logger.info("Plan restaurado tras pago", {
        businessId: subscription.business_id,
        plan: subscription.plan,
      });
    }

    this.sendEmailAsync(() =>
      this.emailService.sendPaymentConfirmation({
        to: business?.email ?? "",
        negocioNombre: business?.nombre ?? "",
        plan: subscription.plan,
        amount: payload.data.amount ?? 0,
        currency: payload.data.currency ?? "UYU",
        nextBillingDate: nextPeriodEnd.toISOString(),
      }),
    );
  }

  private async handlePaymentFailed(payload: DLocalWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    // Si ya está en grace_period no avanzamos — el cron maneja la expiración
    if (subscription.status === "grace_period") return;

    const gracePeriodEndsAt = this.calcGracePeriodEnd(
      subscription.current_period_end,
    );

    const newStatus: SubscriptionStatus =
      subscription.status === "past_due" ? "grace_period" : "past_due";

    await this.subscriptionRepository.updateStatus(
      subscription.id,
      newStatus,
      {
        dlocal_payment_id: payload.data.id,
        grace_period_ends_at:
          newStatus === "grace_period" ? gracePeriodEndsAt : null,
      },
    );

    const business = await this.businessRepository.findById(subscription.business_id);

    if (newStatus === "grace_period") {
      logger.warn("Suscripción en período de gracia", {
        businessId: subscription.business_id,
        gracePeriodEndsAt,
      });

      this.sendEmailAsync(() =>
        this.emailService.sendPaymentFailedGrace({
          to: business?.email ?? "",
          negocioNombre: business?.nombre ?? "",
          gracePeriodEndsAt,
          plan: subscription.plan,
        }),
      );
    } else {
      this.sendEmailAsync(() =>
        this.emailService.sendPaymentFailed({
          to: business?.email ?? "",
          negocioNombre: business?.nombre ?? "",
          plan: subscription.plan,
        }),
      );
    }
  }

  private async handlePaymentReversed(payload: DLocalWebhookPayload): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const gracePeriodEndsAt = this.calcGracePeriodEnd(new Date().toISOString());

    await this.subscriptionRepository.updateStatus(
      subscription.id,
      "grace_period",
      { grace_period_ends_at: gracePeriodEndsAt },
    );

    const business = await this.businessRepository.findById(subscription.business_id);

    logger.warn("Pago revertido / chargeback", {
      businessId: subscription.business_id,
      type: payload.type,
    });

    this.sendEmailAsync(() =>
      this.emailService.sendPaymentFailedGrace({
        to: business?.email ?? "",
        negocioNombre: business?.nombre ?? "",
        gracePeriodEndsAt,
        plan: subscription.plan,
      }),
    );
  }

  private async handleSubscriptionCanceled(
    payload: DLocalWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
      canceled_at: new Date().toISOString(),
    });

    // El negocio sigue con el plan hasta que termine el período actual —
    // el cron lo degradará cuando current_period_end venza
    logger.info("Suscripción cancelada", {
      businessId: subscription.business_id,
      currentPeriodEnd: subscription.current_period_end,
    });
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async findSubscription(
    payload: DLocalWebhookPayload,
  ): Promise<Subscription | null> {
    const dlocalId = payload.data.subscription_id;
    if (!dlocalId) {
      logger.warn("Webhook sin subscription_id", { eventId: payload.id });
      return null;
    }

    const subscription =
      await this.subscriptionRepository.findByDlocalId(dlocalId);

    if (!subscription) {
      logger.warn("Suscripción no encontrada para webhook", {
        dlocalSubscriptionId: dlocalId,
        eventId: payload.id,
      });
      return null;
    }

    return subscription;
  }

  private calcGracePeriodEnd(fromDate: string): string {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
    return d.toISOString();
  }

  /** Despacha emails sin bloquear la respuesta al webhook */
  private sendEmailAsync(fn: () => Promise<void>): void {
    fn().catch((err) =>
      logger.error("Error enviando email de suscripción", { err }),
    );
  }
}
