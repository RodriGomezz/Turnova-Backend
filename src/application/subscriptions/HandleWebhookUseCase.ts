import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";
import { PLAN_PRICES } from "../../domain/plan-prices";

/**
 * Payload real que dLocal Go envía al notification_url.
 *
 * Formato observado en producción (sandbox):
 * {
 *   "invoiceId":      "ST-{subscriptionToken}-{n}",  ← order_id de la ejecución
 *   "subscriptionId": 9163,                           ← ID numérico de la suscripción
 *   "externalId":     "uuid-de-nuestra-bd",           ← el que enviamos en ?external_id=
 *   "mid":            4232
 * }
 *
 * Sin campo "status" — la presencia del webhook indica pago procesado.
 * Para pagos fallidos dLocal Go envía un campo "status": "DECLINED" o similar.
 */
export interface DLocalGoWebhookPayload {
  // Formato real observado (camelCase)
  invoiceId?: string;         // = order_id, formato ST-{token}-{n}
  subscriptionId?: number;    // ID numérico de la suscripción en dLocal Go
  externalId?: string;        // ID interno de nuestra BD (enviado en ?external_id=)
  mid?: number;               // Merchant ID

  // Formato documentado (snake_case) — por si cambia
  subscription_token?: string;
  plan_token?: string;
  order_id?: string;
  subscription_id?: number;
  plan_id?: number;
  external_id?: string;
  client_email?: string;
  id?: number | string;
  type?: string;
  status?: string;
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
    // Normalizar campos camelCase → snake_case
    const normalized = this.normalizePayload(payload);

    logger.info("Webhook dLocal Go recibido", {
      externalId:        normalized.external_id,
      subscriptionId:    normalized.subscription_id,
      invoiceId:         normalized.order_id,
      status:            normalized.status,
      executionStatus:   normalized.execution_status,
    });

    const event = this.detectEvent(normalized);
    logger.info("Webhook dLocal Go evento detectado", { event });

    switch (event) {
      case "PAYMENT_SUCCESS":
        await this.handlePaymentSuccess(normalized);
        break;
      case "PAYMENT_FAILED":
        await this.handleExecutionDeclined(normalized);
        break;
      case "SUBSCRIPTION_CANCELLED":
        await this.handleSubscriptionCancelled(normalized);
        break;
      default:
        logger.warn("Webhook dLocal Go evento desconocido — ignorado", {
          event,
          payload: JSON.stringify(normalized),
        });
    }
  }

  // ── Normalización ─────────────────────────────────────────────────────────

  private normalizePayload(p: DLocalGoWebhookPayload): DLocalGoWebhookPayload {
    return {
      ...p,
      // camelCase → snake_case
      external_id:        p.external_id      ?? p.externalId,
      subscription_id:    p.subscription_id  ?? p.subscriptionId,
      order_id:           p.order_id         ?? p.invoiceId,
    };
  }

  /**
   * Detecta el tipo de evento basado en el payload.
   *
   * Reglas observadas en dLocal Go sandbox:
   * - Solo tiene invoiceId/subscriptionId/externalId → pago exitoso (primer cobro o renovación)
   * - Tiene status DECLINED/FAILED/REJECTED       → pago fallido
   * - Tiene status CANCELLED/CANCELED             → suscripción cancelada
   * - Tiene status CONFIRMED                      → primer pago exitoso (alternativo)
   * - Tiene status COMPLETED                      → renovación exitosa (alternativo)
   */
  private detectEvent(p: DLocalGoWebhookPayload): string {
    const status = (p.status ?? p.execution_status ?? "").toUpperCase();

    if (["DECLINED", "FAILED", "REJECTED"].includes(status)) return "PAYMENT_FAILED";
    if (["CANCELLED", "CANCELED"].includes(status))            return "SUBSCRIPTION_CANCELLED";

    // Pago exitoso: tiene invoiceId/order_id Y (sin status O status positivo)
    const hasInvoice = !!(p.order_id ?? p.invoiceId);
    const hasPositiveStatus = ["CONFIRMED", "COMPLETED", "PAID", "APPROVED", ""].includes(status);

    if (hasInvoice && hasPositiveStatus) return "PAYMENT_SUCCESS";

    return `UNKNOWN:${status}`;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Maneja tanto el primer pago (pending → active) como renovaciones (active → active).
   */
  private async handlePaymentSuccess(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_subscription_id:    payload.subscription_id ?? subscription.dlocal_subscription_id,
      dlocal_subscription_token: payload.subscription_token ?? subscription.dlocal_subscription_token,
      dlocal_last_execution_id:  payload.order_id ?? subscription.dlocal_last_execution_id,
      payer_email:               payload.client_email ?? subscription.payer_email,
      current_period_start:      now.toISOString(),
      current_period_end:        nextPeriodEnd.toISOString(),
      grace_period_ends_at:      null,
    });

    const business = await this.businessRepository.findById(subscription.business_id);
    if (business) {
      const needsUpdate =
        business.plan !== subscription.plan ||
        business.trial_ends_at !== null ||
        business.subscription_downgraded_at !== null;

      if (needsUpdate) {
        await this.businessRepository.update(subscription.business_id, {
          plan: subscription.plan,
          trial_ends_at: null,
          subscription_downgraded_at: null,
        });
      }
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

    logger.info("Suscripción activada por pago exitoso", {
      subscriptionId:  subscription.id,
      businessId:      subscription.business_id,
      plan:            subscription.plan,
      wasStatus:       subscription.status,
      invoiceId:       payload.order_id,
    });
  }

  private async handleExecutionDeclined(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
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
      dlocal_last_execution_id: payload.order_id ?? null,
      grace_period_ends_at:     gracePeriodEndsAt,
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
      businessId:     subscription.business_id,
    });
  }

  // ── Búsqueda de suscripción ───────────────────────────────────────────────

  private async findSubscription(
    payload: DLocalGoWebhookPayload,
  ): Promise<Subscription | null> {
    // 1. Por external_id — el más preciso, lo enviamos como ?external_id= en la URL
    const extId = payload.external_id ?? payload.externalId;
    if (extId) {
      const sub = await this.subscriptionRepository.findById(extId);
      if (sub) {
        logger.info("Suscripción encontrada por external_id", { extId });
        return sub;
      }
    }

    // 2. Por subscription_token
    if (payload.subscription_token) {
      const sub = await this.subscriptionRepository.findBySubscriptionToken(
        payload.subscription_token,
      );
      if (sub) return sub;
    }

    // 3. Por plan_token (solo pending)
    if (payload.plan_token) {
      const sub = await this.subscriptionRepository.findByPlanToken(payload.plan_token);
      if (sub) return sub;
    }

    // 4. Por order_id / invoiceId
    const invoiceId = payload.order_id ?? payload.invoiceId;
    if (invoiceId) {
      const sub = await this.subscriptionRepository.findByExecutionId(invoiceId);
      if (sub) return sub;
    }

    logger.warn("Suscripción no encontrada para webhook de dLocal Go", {
      externalId:        payload.external_id ?? payload.externalId,
      subscriptionId:    payload.subscription_id ?? payload.subscriptionId,
      subscriptionToken: payload.subscription_token,
      invoiceId,
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