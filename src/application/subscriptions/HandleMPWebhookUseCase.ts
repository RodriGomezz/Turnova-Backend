/**
 * HandleMPWebhookUseCase — procesa notificaciones webhook de MercadoPago.
 *
 * MP envía webhooks para dos topics relevantes en suscripciones con plan asociado:
 *
 *   1. subscription_preapproval_plan — creación/actualización de un plan
 *   2. subscription_preapproval      — creación/actualización de una suscripción
 *   3. payments                      — cuando se ejecuta un cobro asociado
 *
 * Payload del webhook de MP (siempre tiene esta forma):
 * {
 *   "action": "payment.created" | "updated",
 *   "api_version": "v1",
 *   "data": { "id": "1234567890" },   ← ID del recurso
 *   "date_created": "2024-01-01T...",
 *   "id": 12345,                       ← ID único del evento
 *   "live_mode": true,
 *   "type": "payment" | "subscription_preapproval" | "subscription_preapproval_plan",
 *   "user_id": "100200300"
 * }
 *
 * El handler hace una consulta GET al recurso indicado (payments o preapproval)
 * para obtener los datos completos — el webhook solo trae el ID.
 *
 * Docs:
 *   - https://www.mercadopago.com/developers/es/docs/your-integrations/notifications/webhooks
 *   - https://www.mercadopago.com/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/additional-info
 */

import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { logger } from "../../infrastructure/logger";
import { PLAN_PRICES } from "../../domain/plan-prices";
import { updateBusinessNetwork, findNetworkBusinessIds } from "../../infrastructure/database/business-network";
import { PLAN_LIMITS } from "../../domain/plan-limits";

const MP_API_BASE = "https://api.mercadopago.com";
const GRACE_PERIOD_DAYS = 7;

// ── Tipos del payload webhook de MP ──────────────────────────────────────────

export interface MPWebhookPayload {
  action?: string;           // "payment.created", "updated", etc.
  api_version?: string;
  data?: { id: string };     // ID del recurso afectado
  date_created?: string;
  id?: number | string;      // ID único del evento (para idempotencia)
  live_mode?: boolean;
  type?: string;             // "payment" | "subscription_preapproval" | "subscription_preapproval_plan"
  user_id?: string;
}

// ── Tipos de la API de MP ─────────────────────────────────────────────────────

interface MPPaymentDetail {
  id: number;
  status: "approved" | "pending" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail: string;
  currency_id: string;
  transaction_amount: number;
  external_reference?: string;    // nuestro subscriptionId interno
  payer?: { email?: string };
  metadata?: Record<string, unknown>;
  date_approved?: string;
  date_created: string;
}

interface MPPreapprovalDetail {
  id: string;
  preapproval_plan_id?: string;
  external_reference?: string;    // nuestro subscriptionId interno
  status: "pending" | "authorized" | "paused" | "cancelled";
  payer_id?: number;
  next_payment_date?: string;
  date_created: string;
}

// ─────────────────────────────────────────────────────────────────────────────

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN no configurado");
  return token;
}

async function fetchMPResource<T>(path: string): Promise<T> {
  const res = await fetch(`${MP_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MP GET ${path} error ${res.status}: ${text}`);
  }

  return JSON.parse(text) as T;
}

// ─────────────────────────────────────────────────────────────────────────────

export class HandleMPWebhookUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(payload: MPWebhookPayload): Promise<void> {
    const resourceId = payload.data?.id;
    const type       = payload.type ?? "";
    const eventId    = String(payload.id ?? "unknown");

    logger.info("Webhook MP recibido", {
      eventId,
      type,
      resourceId,
      action:   payload.action,
      liveMode: payload.live_mode,
    });

    // Despachar por tipo de recurso
    switch (type) {
      case "payment":
        if (resourceId) await this.handlePaymentEvent(resourceId, eventId);
        break;

      case "subscription_preapproval":
        if (resourceId) await this.handlePreapprovalEvent(resourceId, eventId);
        break;

      case "subscription_preapproval_plan":
        // Creación/actualización de un plan — sin acción requerida
        logger.info("Webhook MP: plan de suscripción actualizado", { resourceId });
        break;

      default:
        logger.info("Webhook MP: tipo de evento ignorado", { type, resourceId, eventId });
    }
  }

  // ── Handler: pago ejecutado ───────────────────────────────────────────────

  private async handlePaymentEvent(paymentId: string, eventId: string): Promise<void> {
    let payment: MPPaymentDetail;

    try {
      payment = await fetchMPResource<MPPaymentDetail>(`/v1/payments/${paymentId}`);
    } catch (err) {
      logger.error("MP: no se pudo obtener el pago", { paymentId, err });
      return;
    }

    logger.info("MP: pago obtenido", {
      paymentId,
      status:            payment.status,
      externalReference: payment.external_reference,
      eventId,
    });

    // external_reference = nuestro subscriptionId interno
    const subscription = await this.findSubscriptionByExternalRef(
      payment.external_reference,
    );
    if (!subscription) return;

    switch (payment.status) {
      case "approved":
        await this.handlePaymentApproved(subscription, payment);
        break;

      case "rejected":
      case "cancelled":
        await this.handlePaymentFailed(subscription, paymentId);
        break;

      case "pending":
        // Cobro pendiente — no hacer nada todavía
        logger.info("MP: pago pendiente, esperando aprobación", {
          paymentId,
          subscriptionId: subscription.id,
        });
        break;

      default:
        logger.info("MP: estado de pago no manejado", {
          paymentId,
          status: payment.status,
          subscriptionId: subscription.id,
        });
    }
  }

  // ── Handler: suscripción (preapproval) creada/actualizada ────────────────

  private async handlePreapprovalEvent(
    preapprovalId: string,
    eventId: string,
  ): Promise<void> {
    let preapproval: MPPreapprovalDetail;

    try {
      preapproval = await fetchMPResource<MPPreapprovalDetail>(
        `/preapproval/${preapprovalId}`,
      );
    } catch (err) {
      logger.error("MP: no se pudo obtener el preapproval", { preapprovalId, err });
      return;
    }

    logger.info("MP: preapproval obtenido", {
      preapprovalId,
      status:            preapproval.status,
      externalReference: preapproval.external_reference,
      eventId,
    });

    const subscription = await this.findSubscriptionByExternalRef(
      preapproval.external_reference,
    );
    if (!subscription) return;

    // Siempre actualizamos el preapproval_id en BD para la cancelación
    if (preapproval.status === "authorized") {
      await this.subscriptionRepository.updateStatus(subscription.id, subscription.status, {
        dlocal_subscription_token: preapprovalId,   // guardamos el preapproval_id de MP aquí
      });
      logger.info("MP: preapproval_id almacenado", {
        subscriptionId: subscription.id,
        preapprovalId,
      });
    }

    if (preapproval.status === "cancelled") {
      await this.handleSubscriptionCancelled(subscription);
    }
  }

  // ── Handlers de negocio ───────────────────────────────────────────────────

  private async handlePaymentApproved(
    subscription: Subscription,
    payment: MPPaymentDetail,
  ): Promise<void> {
    const now            = new Date();
    const nextPeriodEnd  = new Date(now);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);

    await this.subscriptionRepository.updateStatus(subscription.id, "active", {
      dlocal_last_execution_id:  String(payment.id),
      payer_email:               payment.payer?.email ?? subscription.payer_email,
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
          await this.enforceMultiSucursalLimit(subscription.business_id, subscription.plan);
        } else {
          await this.businessRepository.update(subscription.business_id, {
            plan: subscription.plan,
            trial_ends_at: null,
            subscription_downgraded_at: null,
          });
        }
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

    logger.info("MP: suscripción activada por pago aprobado", {
      subscriptionId: subscription.id,
      businessId:     subscription.business_id,
      plan:           subscription.plan,
      paymentId:      payment.id,
    });
  }

  private async handlePaymentFailed(
    subscription: Subscription,
    paymentId: string,
  ): Promise<void> {
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
      dlocal_last_execution_id: paymentId,
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

    logger.info("MP: pago fallido procesado", {
      subscriptionId: subscription.id,
      newStatus,
      paymentId,
    });
  }

  private async handleSubscriptionCancelled(subscription: Subscription): Promise<void> {
    await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
      canceled_at: new Date().toISOString(),
    });

    logger.info("MP: suscripción cancelada por webhook", {
      subscriptionId: subscription.id,
      businessId:     subscription.business_id,
    });
  }

  // ── Búsqueda de suscripción ───────────────────────────────────────────────

  /**
   * En MP usamos external_reference para correlacionar el webhook con
   * nuestra suscripción interna. MP garantiza que este campo se pasa tal como
   * lo enviamos al crear el preapproval.
   */
  private async findSubscriptionByExternalRef(
    externalReference?: string,
  ): Promise<Subscription | null> {
    if (!externalReference) {
      logger.warn("MP: webhook sin external_reference — no se puede correlacionar");
      return null;
    }

    // external_reference es nuestro subscriptionId (UUID)
    const sub = await this.subscriptionRepository.findById(externalReference);

    if (!sub) {
      logger.warn("MP: suscripción no encontrada por external_reference", {
        externalReference,
      });
      return null;
    }

    return sub;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async enforceMultiSucursalLimit(
    seedBusinessId: string,
    newPlan: string,
  ): Promise<void> {
    const limits = PLAN_LIMITS[newPlan];
    if (limits?.multiSucursal) return;

    const businessIds = await findNetworkBusinessIds(seedBusinessId);
    if (businessIds.length <= 1) return;

    const toDeactivate = businessIds.slice(1);
    for (const businessId of toDeactivate) {
      await this.businessRepository.update(businessId, { activo: false });
      logger.info("MP: sucursal desactivada por downgrade", {
        businessId,
        newPlan,
        seedBusinessId,
      });
    }
  }

  private calcGracePeriodEnd(fromDate: string): string {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
    return d.toISOString();
  }

  private fireAndForget(fn: () => Promise<void>): void {
    fn().catch((err) =>
      logger.error("MP: error enviando email de suscripción", { err }),
    );
  }
}