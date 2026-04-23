import { logger } from "../logger";
import {
  IPaymentProvider,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  SubscriptionDetails,
} from "../../application/ports/IPaymentProvider";
import { PLAN_PRICES } from "../../domain/plan-prices";

interface DLocalGoPaymentRequest {
  country_code: string;
  currency: string;
  amount: number;
  success_url: string;
  back_url: string;
  notification_url: string;
  order_id: string;
  description: string;
  payer: { name: string; email: string };
}

interface DLocalGoPaymentResponse {
  id: string;
  status: string;
  redirect_url: string;
  order_id: string;
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

const DLOCAL_GO_SANDBOX_API = "https://api-sbx.dlocalgo.com";
const DLOCAL_GO_PROD_API    = "https://api.dlocalgo.com";
const COUNTRY_CODE = "UY";
const CURRENCY     = "UYU";

function getBaseUrl(): string {
  return process.env.DLOCAL_SANDBOX === "true"
    ? DLOCAL_GO_SANDBOX_API
    : DLOCAL_GO_PROD_API;
}

function buildHeaders(): Record<string, string> {
  const apiKey = process.env.DLOCAL_API_KEY ?? "";
  const apiSecret = process.env.DLOCAL_API_SECRET ?? "";
  
  return {
    "Authorization": `Bearer ${apiKey}:${apiSecret}`,
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
      ...context, status: res.status, code: err.code, message: err.message,
    });
    throw new Error(`dLocal Go [${err.code}]: ${err.message}`);
  }
  return body as T;
}

export const dlocalClient: IPaymentProvider = {
  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const amount  = PLAN_PRICES[input.plan];
    const orderId = `${input.businessId}_${Date.now()}`;

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
        name: `${input.firstName} ${input.lastName}`.trim(),
        email: input.email,
      },
    };

    logger.info("dLocal Go createPayment", {
      businessId: input.businessId,
      plan:       input.plan,
      amount,
      orderId,
      sandbox:    process.env.DLOCAL_SANDBOX,
    });

    const res = await fetch(`${getBaseUrl()}/v1/payments`, {
      method:  "POST",
      headers: buildHeaders(),
      body:    JSON.stringify(payload),
    });

    const data = await parseResponse<DLocalGoPaymentResponse>(
      res, "createPayment", { businessId: input.businessId, orderId },
    );

    if (!data.redirect_url) {
      throw new Error("dLocal Go no devolvió una redirect_url");
    }

    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    return {
      subscriptionId:  orderId,
      checkoutUrl:     data.redirect_url,
      nextBillingDate: nextBillingDate.toISOString(),
    };
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    logger.info("dLocal Go cancelSubscription", { subscriptionId });
    const res = await fetch(
      `${getBaseUrl()}/v1/subscriptions/${subscriptionId}/cancel`,
      { method: "POST", headers: buildHeaders() },
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      let body: DLocalGoErrorResponse = { code: res.status, message: text };
      try { body = JSON.parse(text) as DLocalGoErrorResponse; } catch { /* noop */ }
      throw new Error(`dLocal Go [${body.code}]: ${body.message}`);
    }
  },

  async refundPayment(paymentId: string): Promise<void> {
    logger.info("dLocal Go refundPayment", { paymentId });
    const res = await fetch(
      `${getBaseUrl()}/v1/payments/${paymentId}/refund`,
      { method: "POST", headers: buildHeaders() },
    );
    if (!res.ok) {
      const text = await res.text();
      let body: DLocalGoErrorResponse = { code: res.status, message: text };
      try { body = JSON.parse(text) as DLocalGoErrorResponse; } catch { /* noop */ }
      throw new Error(`dLocal Go [${body.code}]: ${body.message}`);
    }
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionDetails> {
    const res = await fetch(
      `${getBaseUrl()}/v1/subscriptions/${subscriptionId}`,
      { method: "GET", headers: buildHeaders() },
    );
    const data = await parseResponse<DLocalGoSubscriptionResponse>(
      res, "getSubscription", { subscriptionId },
    );
    return {
      subscriptionId:  data.id,
      status:          mapDLocalGoStatus(data.status),
      nextBillingDate: data.next_charge_at,
    };
  },
};

function mapDLocalGoStatus(
  status: DLocalGoSubscriptionResponse["status"],
): SubscriptionDetails["status"] {
  switch (status) {
    case "active":   return "active";
    case "paused":   return "paused";
    case "canceled": return "canceled";
  }
}
