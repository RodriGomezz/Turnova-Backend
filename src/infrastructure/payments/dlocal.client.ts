import { logger } from "../logger";
import {
  IPaymentProvider,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  SubscriptionDetails,
} from "../../application/ports/IPaymentProvider";
import { PLAN_PRICES } from "../../domain/plan-prices";

// ── Tipos internos de la API de dLocal Go ─────────────────────────────────────

interface DLocalGoPaymentRequest {
  country_code: string;
  currency: string;
  amount: number;
  success_url: string;
  back_url: string;
  notification_url: string;
  order_id: string;
  description: string;
  payer: {
    name: string;
    email: string;
  };
}

interface DLocalGoPaymentResponse {
  id: string;
  status: string;
  redirect_url: string;
  order_id: string;
}

interface DLocalGoSubscriptionPlanRequest {
  name: string;
  description: string;
  amount: number;
  currency: string;
  country_code: string;
  interval: "monthly";
  notification_url: string;
  success_url: string;
  back_url: string;
}

interface DLocalGoSubscriptionPlanResponse {
  id: string;
  name: string;
  amount: number;
  currency: string;
  status: string;
  redirect_url: string;
}

interface DLocalGoSubscriptionResponse {
  id: string;
  status: "active" | "paused" | "canceled";
  plan_id: string;
  payer_email: string;
  next_charge_at: string | null;
}

interface DLocalGoErrorResponse {
  code: string | number;
  message: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DLOCAL_GO_SANDBOX_API = "https://api-sbx.dlocalgo.com";
const DLOCAL_GO_PROD_API    = "https://api.dlocalgo.com";
const COUNTRY_CODE = "UY";
const CURRENCY     = "UYU";

function getBaseUrl(): string {
  return process.env.NODE_ENV === "production"
    ? DLOCAL_GO_PROD_API
    : DLOCAL_GO_SANDBOX_API;
}

// ── Helpers privados ──────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  return {
    "X-Api-Key":    process.env.DLOCAL_API_KEY    ?? "",
    "X-Api-Secret": process.env.DLOCAL_API_SECRET ?? "",
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(
  res: Response,
  operation: string,
  context: Record<string, unknown> = {},
): Promise<T> {
  const text = await res.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    logger.error(`dLocal Go ${operation}: respuesta no es JSON`, { text, ...context });
    throw new Error(`dLocal Go error: respuesta inválida (${res.status})`);
  }

  if (!res.ok) {
    const err = body as unknown as DLocalGoErrorResponse;
    logger.error(`dLocal Go ${operation} error`, {
      ...context,
      status: res.status,
      code:    err.code,
      message: err.message,
    });
    throw new Error(`dLocal Go [${err.code}]: ${err.message}`);
  }

  return body as T;
}

// ── Cliente ───────────────────────────────────────────────────────────────────

export const dlocalClient: IPaymentProvider = {
  /**
   * Crea un pago único de suscripción en dLocal Go.
   * El usuario es redirigido al checkout para completar el pago.
   * Tras el pago, dLocal Go crea automáticamente la suscripción recurrente
   * si se usa un plan previamente creado en el dashboard.
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const amount = PLAN_PRICES[input.plan];
    const orderId = `${input.businessId}-${Date.now()}`;

    const payload: DLocalGoPaymentRequest = {
      country_code:     COUNTRY_CODE,
      currency:         CURRENCY,
      amount,
      success_url:      input.successUrl,
      back_url:         input.cancelUrl,
      notification_url: `${process.env.API_URL ?? "http://localhost:3000"}/api/subscriptions/dlocal`,
      order_id:         orderId,
      description:      `Turnio Plan ${input.plan} — suscripción mensual`,
      payer: {
        name:  input.nombre,
        email: input.email,
      },
    };

    logger.info("dLocal Go createPayment", {
      businessId: input.businessId,
      plan:       input.plan,
      amount,
      orderId,
      env:        process.env.NODE_ENV,
    });

    const res = await fetch(`${getBaseUrl()}/v1/payments`, {
      method:  "POST",
      headers: buildHeaders(),
      body:    JSON.stringify(payload),
    });

    const data = await parseResponse<DLocalGoPaymentResponse>(
      res,
      "createPayment",
      { businessId: input.businessId, orderId },
    );

    if (!data.redirect_url) {
      throw new Error("dLocal Go no devolvió una redirect_url");
    }

    // dLocal Go no devuelve subscription_id en el primer pago —
    // lo recibimos via webhook cuando el pago es confirmado.
    // Usamos el order_id como identificador provisional.
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    return {
      subscriptionId: orderId, // provisional hasta recibir webhook
      checkoutUrl:    data.redirect_url,
      nextBillingDate: nextBillingDate.toISOString(),
    };
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    logger.info("dLocal Go cancelSubscription", { subscriptionId });

    const res = await fetch(
      `${getBaseUrl()}/v1/subscriptions/${subscriptionId}/cancel`,
      {
        method:  "POST",
        headers: buildHeaders(),
      },
    );

    // 404 = ya cancelada, lo tratamos como éxito
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      let body: DLocalGoErrorResponse = { code: res.status, message: text };
      try { body = JSON.parse(text) as DLocalGoErrorResponse; } catch { /* noop */ }
      logger.error("dLocal Go cancelSubscription error", {
        subscriptionId,
        status:  res.status,
        message: body.message,
      });
      throw new Error(`dLocal Go [${body.code}]: ${body.message}`);
    }
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionDetails> {
    const res = await fetch(
      `${getBaseUrl()}/v1/subscriptions/${subscriptionId}`,
      {
        method:  "GET",
        headers: buildHeaders(),
      },
    );

    const data = await parseResponse<DLocalGoSubscriptionResponse>(
      res,
      "getSubscription",
      { subscriptionId },
    );

    return {
      subscriptionId: data.id,
      status:         mapDLocalGoStatus(data.status),
      nextBillingDate: data.next_charge_at,
    };
  },
};

// ── Mapeo de estados ──────────────────────────────────────────────────────────

function mapDLocalGoStatus(
  status: DLocalGoSubscriptionResponse["status"],
): SubscriptionDetails["status"] {
  switch (status) {
    case "active":   return "active";
    case "paused":   return "paused";
    case "canceled": return "canceled";
  }
}
