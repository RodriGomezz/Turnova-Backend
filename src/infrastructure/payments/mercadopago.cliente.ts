/**
 * MercadoPago Client — implementación de IPaymentProvider
 *
 * FLUJO CORRECTO para checkout hosted (sin card_token_id):
 *
 *   Suscripción SIN plan asociado, status: "pending"
 *   ─────────────────────────────────────────────────
 *   1. POST /preapproval con los datos del plan embebidos (reason, auto_recurring)
 *      y status: "pending" → MP devuelve un init_point navegable.
 *   2. Redirigir al usuario a init_point → completa el pago en la página de MP.
 *   3. MP envía webhook type: "subscription_preapproval" cuando cambia el estado.
 *   4. Cuando el usuario paga, status pasa a "authorized" → activar en nuestra BD.
 *
 *   ⚠️ El flujo CON plan asociado (preapproval_plan + preapproval) requiere
 *   card_token_id (tarjeta ya tokenizada por el frontend via Bricks/Checkout API).
 *   No genera un init_point navegable — no sirve para hosted checkout.
 *
 * Docs:
 *   https://www.mercadopago.com/developers/es/reference/subscriptions/_preapproval/post
 *   https://www.mercadopago.com/developers/es/docs/subscriptions/integration-configuration/subscription-without-plan
 */

import { logger } from "../logger";
import {
  CreateCheckoutResult,
  ExecutionDetails,
  IPaymentProvider,
  SubscriptionDetails,
} from "../../application/ports/IPaymentProvider";
import { SubscriptionPlan } from "../../domain/entities/Subscription";
import { PLAN_PRICES, PLAN_NAMES } from "../../domain/plan-prices";

// ── Constantes ────────────────────────────────────────────────────────────────

const MP_API_BASE    = "https://api.mercadopago.com";
const CURRENCY_ID    = "UYU";
const FREQUENCY      = 1;
const FREQUENCY_TYPE = "months";

// ── Tipos internos ────────────────────────────────────────────────────────────

interface MPPreapproval {
  id: string;
  reason?: string;
  external_reference?: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point: string;
  sandbox_init_point?: string;
  payer_id?: number;
  payer_email?: string;
  next_payment_date?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  date_created: string;
  last_modified: string;
}

interface MPPayment {
  id: number;
  status: "approved" | "pending" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail: string;
  currency_id: string;
  transaction_amount: number;
  payer?: { email?: string };
  external_reference?: string;
  date_approved?: string;
  date_created: string;
}

interface MPErrorResponse {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{ code: string; description: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "MP_ACCESS_TOKEN no configurado. " +
      "Obtenelo en: https://www.mercadopago.com/developers/panel",
    );
  }
  return token;
}

function mpHeaders(idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization:  `Bearer ${getAccessToken()}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
  return headers;
}

function idemKey(operation: string, ...parts: string[]): string {
  return `kronu-${operation}-${parts.join("-")}`;
}

async function parseResponse<T>(
  res: Response,
  operation: string,
  context: Record<string, unknown> = {},
): Promise<T> {
  const text = await res.text();
  let body: unknown;

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    logger.error(`MP ${operation}: respuesta no es JSON`, { text, ...context });
    throw new Error(`MercadoPago error: respuesta inválida (${res.status})`);
  }

  if (!res.ok) {
    const err    = body as MPErrorResponse;
    const cause  = err.cause?.map((c) => `${c.code}: ${c.description}`).join("; ");
    const message = err.message ?? err.error ?? "Error desconocido";
    logger.error(`MP ${operation} error`, { ...context, status: res.status, message, cause });
    throw new Error(`MercadoPago [${res.status}]: ${message}${cause ? ` — ${cause}` : ""}`);
  }

  return body as T;
}

// ── Cliente MercadoPago ───────────────────────────────────────────────────────

export const mercadoPagoClient: IPaymentProvider = {

  /**
   * Crea un preapproval SIN plan asociado con status "pending".
   * Este es el único flujo que genera un init_point navegable
   * (hosted checkout de MP) sin requerir card_token_id del frontend.
   *
   * El external_reference = subscriptionId de nuestra BD
   * permite correlacionar el webhook con la suscripción interna.
   */
  async getOrCreatePlan(
    plan: SubscriptionPlan,
    _notificationUrl: string,   // Se configura en Dashboard MP, no via API
    _successUrl: string,        // MP no acepta success_url en preapproval sin plan
    backUrl: string,
    _errorUrl: string,          // MP no tiene error_url
    externalReference?: string,
    payerEmail?: string,
  ): Promise<CreateCheckoutResult> {
    if (!externalReference) {
      throw new Error(
        "MP getOrCreatePlan: externalReference es requerido. " +
        "Pasá el subscriptionId de tu BD para correlacionar los webhooks.",
      );
    }

    const amount   = PLAN_PRICES[plan];
    const planName = PLAN_NAMES[plan];

    logger.info("MP: creando preapproval (suscripción sin plan asociado)", {
      plan,
      amount,
      externalReference,
      hasPayerEmail: !!payerEmail,
    });

    /**
     * POST /preapproval — suscripción sin plan asociado
     *
     * Al no enviar preapproval_plan_id, MP genera un init_point
     * navegable donde el usuario ingresa su tarjeta.
     * status: "pending" → el usuario aún no autorizó el débito.
     */
    const body: Record<string, unknown> = {
      reason:             planName,
      external_reference: externalReference,
      payer_email:        payerEmail ?? "",
      auto_recurring: {
        frequency:          FREQUENCY,
        frequency_type:     FREQUENCY_TYPE,
        transaction_amount: amount,
        currency_id:        CURRENCY_ID,
      },
      back_url: backUrl,
      status:   "pending",
    };

    const res = await fetch(`${MP_API_BASE}/preapproval`, {
      method:  "POST",
      headers: mpHeaders(idemKey("createPreapproval", externalReference)),
      body:    JSON.stringify(body),
    });

    const preapproval = await parseResponse<MPPreapproval>(res, "createPreapproval", {
      plan,
      externalReference,
    });

    logger.info("MP: preapproval creado exitosamente", {
      preapprovalId: preapproval.id,
      initPoint:     preapproval.init_point,
      externalReference,
      plan,
    });

    return {
      // planToken guarda el preapproval_id — lo necesitamos para cancelar
      planToken:    preapproval.id,
      subscribeUrl: preapproval.init_point,
      dlocalPlanId: null,
    };
  },

  /**
   * Cancela un preapproval via PUT /preapproval/{id} con status: "cancelled".
   * El preapproval_id se almacena en dlocal_plan_token (campo planToken del resultado).
   */
  async cancelSubscription(_planId: number, subscriptionId: number): Promise<void> {
    const preapprovalId = String(subscriptionId);

    logger.info("MP: cancelando preapproval", { preapprovalId });

    const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
      method:  "PUT",
      headers: mpHeaders(idemKey("cancelPreapproval", preapprovalId)),
      body:    JSON.stringify({ status: "cancelled" }),
    });

    if (!res.ok && res.status !== 404) {
      await parseResponse(res, "cancelSubscription", { preapprovalId });
    }

    logger.info("MP: preapproval cancelado", { preapprovalId });
  },

  async getSubscription(
    _planId: number,
    subscriptionId: number,
  ): Promise<SubscriptionDetails> {
    const preapprovalId = String(subscriptionId);

    const res = await fetch(`${MP_API_BASE}/preapproval/${preapprovalId}`, {
      headers: mpHeaders(),
    });

    const data = await parseResponse<MPPreapproval>(res, "getSubscription", {
      preapprovalId,
    });

    const mpStatusMap: Record<string, "CREATED" | "CONFIRMED"> = {
      pending:    "CREATED",
      authorized: "CONFIRMED",
      paused:     "CONFIRMED",
      cancelled:  "CREATED",
    };

    return {
      subscriptionId:    parseInt(preapprovalId, 10),
      subscriptionToken: data.id,
      status:            mpStatusMap[data.status] ?? "CREATED",
      active:            data.status === "authorized",
      scheduledDate:     data.next_payment_date ?? null,
      clientEmail:       data.payer_email ?? null,
    };
  },

  async getExecution(
    _subscriptionId: number,
    executionId: string,
  ): Promise<ExecutionDetails> {
    const res = await fetch(`${MP_API_BASE}/v1/payments/${executionId}`, {
      headers: mpHeaders(),
    });

    const data = await parseResponse<MPPayment>(res, "getExecution", { executionId });

    const statusMap: Record<string, "PENDING" | "COMPLETED" | "DECLINED"> = {
      approved:     "COMPLETED",
      pending:      "PENDING",
      rejected:     "DECLINED",
      cancelled:    "DECLINED",
      refunded:     "DECLINED",
      charged_back: "DECLINED",
    };

    return {
      executionId: data.id,
      orderId:     String(data.id),
      status:      statusMap[data.status] ?? "PENDING",
      currency:    data.currency_id,
      amountPaid:  data.transaction_amount,
    };
  },
};