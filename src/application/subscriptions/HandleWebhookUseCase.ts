import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus, BillingCycle } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";
import { PLAN_PRICES_MONTHLY, PLAN_PRICES_ANNUAL } from "../../domain/plan-prices";
import { updateBusinessNetwork, findNetworkBusinessIds } from "../../infrastructure/database/business-network";
import { PLAN_LIMITS } from "../../domain/plan-limits";

/**
 * Payload real que dLocal Go envía al notification_url.
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
    const normalized = this.normalizePayload(payload);

    logger.info("Webhook dLocal Go recibido", {
      externalId:      normalized.external_id,
      subscriptionId:  normalized.subscription_id,
      invoiceId:       normalized.order_id,
      status:          normalized.status,
      executionStatus: normalized.execution_status,
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
          payloadKeys: Object.keys(normalized),
        });
    }
  }

  // ── Normalización ─────────────────────────────────────────────────────────

  private normalizePayload(p: DLocalGoWebhookPayload): DLocalGoWebhookPayload {
    return {
      ...p,
      external_id:     p.external_id     ?? p.externalId,
      subscription_id: p.subscription_id ?? p.subscriptionId,
      order_id:        p.order_id        ?? p.invoiceId,
    };
  }

  private detectEvent(p: DLocalGoWebhookPayload): string {
    const status = (p.status ?? p.execution_status ?? "").toUpperCase();

    if (["DECLINED", "FAILED", "REJECTED"].includes(status)) return "PAYMENT_FAILED";
    if (["CANCELLED", "CANCELED"].includes(status))           return "SUBSCRIPTION_CANCELLED";

    const hasInvoice       = !!(p.order_id ?? p.invoiceId);
    const hasPositiveStatus = ["CONFIRMED", "COMPLETED", "PAID", "APPROVED", ""].includes(status);

    if (hasInvoice && hasPositiveStatus) return "PAYMENT_SUCCESS";

    return `UNKNOWN:${status}`;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handlePaymentSuccess(
    payload: DLocalGoWebhookPayload,
  ): Promise<void> {
    const subscription = await this.findSubscription(payload);
    if (!subscription) return;

    const now = new Date();
    const nextPeriodEnd = new Date(now);

    // ── Período según ciclo de facturación ───────────────────────────────
    // Para suscripciones anuales el período es de 365 días; para mensuales, 30.
    const cycle: BillingCycle = subscription.billing_cycle ?? "monthly";
    if (cycle === "annual") {
      nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
    } else {
      nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);
    }

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
        if (subscription.plan === "business") {
          await updateBusinessNetwork(subscription.business_id, {
            plan: "business",
            trial_ends_at: null,
            subscription_downgraded_at: null,
          });
          // Al subir a business se reactivan las sucursales si las hubiera;
          // enforceMultiSucursalLimit solo desactiva, aquí no es necesario.
        } else {
          await this.businessRepository.update(subscription.business_id, {
            plan: subscription.plan,
            trial_ends_at: null,
            subscription_downgraded_at: null,
          });

          // ── [BUG-001] CRÍTICO: Al bajar de business a pro/starter, las
          // sucursales adicionales deben quedar desactivadas. Sin esto siguen
          // funcionando con los beneficios del plan superior.
          await this.enforceMultiSucursalLimit(
            subscription.business_id,
            subscription.plan,
          );
        }
      }
    }

    const planPrice =
      cycle === "annual"
        ? PLAN_PRICES_ANNUAL[subscription.plan] ?? 0
        : PLAN_PRICES_MONTHLY[subscription.plan] ?? 0;

    this.fireAndForget(() =>
      this.emailService.sendPaymentConfirmation({
        to:              business?.email ?? "",
        negocioNombre:   business?.nombre ?? "",
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
      invoiceId:      payload.order_id,
    });
  }

  /**
   * [BUG-001] Desactiva sucursales adicionales cuando el plan no incluye
   * multi-sucursal. Se aplica SIEMPRE que hay un pago exitoso en plan ≠ business,
   * cubriendo tanto primeras suscripciones como downgrades desde business.
   *
   * La lógica: la sucursal principal (la más antigua por created_at en
   * user_businesses) queda activa; el resto se desactivan.
   */
  private async enforceMultiSucursalLimit(
    seedBusinessId: string,
    newPlan: string,
  ): Promise<void> {
    const limits = PLAN_LIMITS[newPlan];
    if (limits?.multiSucursal) return; // business plan — sin restricción

    const businessIds = await findNetworkBusinessIds(seedBusinessId);
    if (businessIds.length <= 1) return;

    // findNetworkBusinessIds ordena por created_at ASC → el primero es el principal
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
    const extId = payload.external_id ?? payload.externalId;
    if (extId) {
      const sub = await this.subscriptionRepository.findById(extId);
      if (sub) {
        logger.info("Suscripción encontrada por external_id", { extId });
        return sub;
      }
    }

    if (payload.subscription_token) {
      const sub = await this.subscriptionRepository.findBySubscriptionToken(
        payload.subscription_token,
      );
      if (sub) return sub;
    }

    if (payload.plan_token) {
      const sub = await this.subscriptionRepository.findByPlanToken(payload.plan_token);
      if (sub) return sub;
    }

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
