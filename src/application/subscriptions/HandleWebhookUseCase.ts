import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";
import { PLAN_PRICES } from "../../domain/plan-prices";

/**
 * Payload que dLocal Go envía al notification_url del plan.
 *
 * Los campos clave según la documentación:
 *  - subscription_token: identifica la suscripción
 *  - status: CREATED | CONFIRMED (suscripción) o PENDING | COMPLETED | DECLINED (ejecución)
 *  - order_id: ID de la ejecución (cobro), formato ST-{token}-{n}
 *  - type: "subscription" | "execution"
 */
export interface DLocalGoWebhookPayload {
  type?: string;
  // Campos de suscripción
  subscription_token?: string;
  plan_token?: string;
  status?: string;
  client_email?: string;
  id?: number | string;
  // Campos de ejecución (cobro)
  order_id?: string;
  subscription_id?: number;
  plan_id?: number;
  // Estado del cobro
  execution_status?: string;
}

const GRACE_PERIOD_DAYS = 7;

export class HandleWebhookUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(payload: DLocalGoWebhookPayload): Promise<void> {
    const normalizedStatus = this.normalizeStatus(
      payload.execution_status ?? payload.status,
    );

    logger.info("Webhook dLocal Go recibido", {
      type: payload.type,
      subscriptionToken: payload.subscription_token,
      planToken: payload.plan_token,
      orderId: payload.order_id,
      status: payload.status,
      executionStatus: payload.execution_status,
      normalizedStatus,
    });

    switch (normalizedStatus) {
      case "CONFIRMED":
        // Primera confirmación: el usuario completó el checkout y el primer pago fue exitoso
        await this.handleSubscriptionConfirmed(payload);
        break;

      case "COMPLETED":
        // Cobro recurrente exitoso
        await this.handleExecutionCompleted(payload);
        break;

      case "DECLINED":
        // Cobro fallido
        await this.handleExecutionDeclined(payload);
        break;

      case "CANCELLED":
        // Suscripción cancelada desde el lado de dLocal Go
        await this.handleSubscriptionCancelled(payload);
        break;

      default:
        logger.info("Evento dLocal Go ignorado", { normalizedStatus, payload });
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleSubscriptionConfirmed(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_subscription_id: payload.subscription_id ?? null,
      dlocal_subscription_token: payload.subscription_token ?? null,
      dlocal_last_execution_id: payload.order_id ?? null,
      payer_email: payload.client_email ?? subscription.payer_email,
      current_period_start: now.toISOString(),
      current_period_end: nextPeriodEnd.toISOString(),
      grace_period_ends_at: null,
    });

    const business = await this.businessRepository.findById(subscription.business_id);
    if (
      business &&
      (business.plan !== subscription.plan ||
        business.trial_ends_at !== null ||
        business.subscription_downgraded_at !== null)
    ) {
      await this.businessRepository.update(subscription.business_id, {
        plan: subscription.plan,
        trial_ends_at: null,
        subscription_downgraded_at: null,
      });
    }

    this.fireAndForget(() =>
      this.emailService.sendPaymentConfirmation({
        to: business?.email ?? "",
        negocioNombre: business?.nombre ?? "",
        plan: subscription.plan,
        amount: PLAN_PRICES[subscription.plan] ?? 0,
        currency: "UYU",
        nextBillingDate: nextPeriodEnd.toISOString(),
      }),
    );

    logger.info("Suscripción confirmada y activada", {
      subscriptionId: subscription.id,
      businessId: subscription.business_id,
      plan: subscription.plan,
    });
  }

  private async handleExecutionCompleted(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_last_execution_id: payload.order_id ?? null,
      current_period_start: now.toISOString(),
      current_period_end: nextPeriodEnd.toISOString(),
      grace_period_ends_at: null,
    });

    const business = await this.businessRepository.findById(subscription.business_id);
    if (business && business.plan !== subscription.plan) {
      await this.businessRepository.update(subscription.business_id, {
        plan: subscription.plan,
        trial_ends_at: null,
        subscription_downgraded_at: null,
      });
    }

    this.fireAndForget(() =>
      this.emailService.sendPaymentConfirmation({
        to: business?.email ?? "",
        negocioNombre: business?.nombre ?? "",
        plan: subscription.plan,
        amount: PLAN_PRICES[subscription.plan] ?? 0,
        currency: "UYU",
        nextBillingDate: nextPeriodEnd.toISOString(),
      }),
    );
  }

  private async handleExecutionDeclined(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    // Si estaba pending (nunca pagó), cancelar directamente
    if (subscription.status === "pending") {
      await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
        canceled_at: new Date().toISOString(),
      });
      return;
    }

    // Si ya estaba en gracia, no hacer nada más (dLocal Go dejará de reintentar)
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
      dlocal_last_execution_id: payload.order_id ?? null,
      grace_period_ends_at: gracePeriodEndsAt,
    });

    const business = await this.businessRepository.findById(subscription.business_id);

    if (newStatus === "grace_period") {
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailedGrace({
          to: business?.email ?? "",
          negocioNombre: business?.nombre ?? "",
          plan: subscription.plan,
          gracePeriodEndsAt: gracePeriodEndsAt ?? "",
        }),
      );
    } else {
      this.fireAndForget(() =>
        this.emailService.sendPaymentFailed({
          to: business?.email ?? "",
          negocioNombre: business?.nombre ?? "",
          plan: subscription.plan,
        }),
      );
    }
  }

  private async handleSubscriptionCancelled(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
      canceled_at: new Date().toISOString(),
    });

    logger.info("Suscripción cancelada por webhook de dLocal Go", {
      subscriptionId: subscription.id,
      businessId: subscription.business_id,
    });
  }

  // ── Búsqueda de suscripción ───────────────────────────────────────────────

  private async findSubscription(
    payload: DLocalGoWebhookPayload,
  ): Promise<Subscription | null> {
    // 1. Por subscription_token (el más confiable)
    if (payload.subscription_token) {
      const sub = await this.subscriptionRepository.findBySubscriptionToken(
        payload.subscription_token,
      );
      if (sub) return sub;
    }

    // 2. Por plan_token (para el primer webhook CONFIRMED donde aún no hay subscription_token)
    if (payload.plan_token) {
      const sub = await this.subscriptionRepository.findByPlanToken(payload.plan_token);
      if (sub) return sub;
    }

    // 3. Por order_id de la ejecución
    if (payload.order_id) {
      const sub = await this.subscriptionRepository.findByExecutionId(payload.order_id);
      if (sub) return sub;
    }

    logger.warn("Suscripción no encontrada para webhook de dLocal Go", {
      subscriptionToken: payload.subscription_token,
      planToken: payload.plan_token,
      orderId: payload.order_id,
    });
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalizeStatus(status?: string): string {
    switch ((status ?? "").toUpperCase()) {
      case "CONFIRMED":
        return "CONFIRMED";
      case "COMPLETED":
        return "COMPLETED";
      case "DECLINED":
      case "FAILED":
      case "REJECTED":
        return "DECLINED";
      case "CANCELLED":
      case "CANCELED":
        return "CANCELLED";
      case "PENDING":
      case "CREATED":
        return "PENDING";
      default:
        return (status ?? "").toUpperCase();
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