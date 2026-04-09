import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";

export interface DLocalGoWebhookPayload {
  payment_id: string;
  order_id?: string;
  status?: "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED" | "REFUNDED";
}

const GRACE_PERIOD_DAYS = 7;

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
      case "PAID":       await this.handlePaymentPaid(payload);      break;
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

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_subscription_id: payload.payment_id,
      dlocal_payment_id:      payload.payment_id,
      current_period_start:   now.toISOString(),
      current_period_end:     nextPeriodEnd.toISOString(),
      grace_period_ends_at:   null,
    });

    const business = await this.businessRepository.findById(subscription.business_id);
    if (business && business.plan !== subscription.plan) {
      await this.businessRepository.update(subscription.business_id, {
        plan: subscription.plan,
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
    const subscription = await this.findSubscription(payload);
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

    const gracePeriodEndsAt = this.calcGracePeriodEnd(new Date().toISOString());
    await this.subscriptionRepository.updateStatus(subscription.id, "grace_period", {
      grace_period_ends_at: gracePeriodEndsAt,
    });

    const business = await this.businessRepository.findById(subscription.business_id);
    this.fireAndForget(() =>
      this.emailService.sendPaymentFailedGrace({
        to:                business?.email ?? "",
        negocioNombre:     business?.nombre ?? "",
        plan:              subscription.plan,
        gracePeriodEndsAt,
      }),
    );
  }

  // ── Búsqueda de suscripción ───────────────────────────────────────────────

  private async findSubscription(
    payload: DLocalGoWebhookPayload,
  ): Promise<Subscription | null> {
    // 1. Por payment_id (pagos recurrentes posteriores al primero)
    let sub = await this.subscriptionRepository.findByDlocalId(payload.payment_id);
    if (sub) return sub;

    // 2. Por order_id — extraer businessId (formato uuid_timestamp)
    if (payload.order_id) {
      const businessId = payload.order_id.split("_")[0];
      if (businessId) {
        sub = await this.subscriptionRepository.findByBusinessId(businessId);
        if (sub) return sub;
      }

      // 3. order_id directo como dlocal_subscription_id
      sub = await this.subscriptionRepository.findByDlocalId(payload.order_id);
      if (sub) return sub;
    }

    // 4. Fallback: dLocal Go no siempre envía order_id en el primer webhook.
    //    Buscar la suscripción más reciente cuyo dlocal_subscription_id
    //    todavía es el order_id provisional (no empieza con "DP-")
    const recent = await this.subscriptionRepository.findMostRecentPending();
    if (recent) {
      logger.info("Suscripción encontrada por fallback", {
        subscriptionId: recent.id,
        paymentId:      payload.payment_id,
      });
      return recent;
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

const PLAN_PRICES_MAP: Record<string, number> = {
  pro:      1390,
  business: 2290,
};
