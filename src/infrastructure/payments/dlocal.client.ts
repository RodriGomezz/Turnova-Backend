import { logger } from "../logger";
import {
  IPaymentProvider,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  SubscriptionDetails,
} from "../../application/ports/IPaymentProvider";
import { PLAN_PRICES } from "../../domain/plan-prices";

// ── Tipos internos de la API de dLocal Go ─────────────────────────────────────

interface DLocalPaymentRequest {
  amount: number;
  currency: string;
  country: string;
  description: string;
  order_id: string;
  notification_url: string;
  success_url: string;
  back_url: string;
  payer: {
    name: string;
    email: string;
  };
  subscription: {
    plan_id: string;
    description: string;
  };
}

interface DLocalPaymentResponse {
  id: string;
  status: string;
  redirect_url: string;
  order_id: string;
  subscription_id?: string;
  next_action?: {
    redirect_to_url?: {
      url: string;
    };
  };
}

interface DLocalSubscriptionResponse {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELED" | "PAST_DUE";
  next_charge_at: string | null;
  plan_id: string;
}

interface DLocalErrorResponse {
  code: string;
  message: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DLOCAL_API = "https://api.dlocalgo.com";
/** Uruguay — código ISO 3166-1 alfa-2 */
const COUNTRY = "UY";
const CURRENCY = "UYU";

// ── Helpers privados ──────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  return {
    "X-Api-Key": process.env.DLOCAL_API_KEY ?? "",
    "X-Api-Secret": process.env.DLOCAL_API_SECRET ?? "",
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(
  res: Response,
  operation: string,
  context: Record<string, unknown> = {},
): Promise<T> {
  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const err = body as unknown as DLocalErrorResponse;
    logger.error(`dLocal ${operation} error`, {
      ...context,
      status: res.status,
      code: err.code,
      message: err.message,
    });
    throw new Error(`dLocal error [${err.code}]: ${err.message}`);
  }

  return body as T;
}

// ── Cliente ───────────────────────────────────────────────────────────────────

export const dlocalClient: IPaymentProvider = {
  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const amount = PLAN_PRICES[input.plan];
    const planId = process.env[`DLOCAL_PLAN_ID_${input.plan.toUpperCase()}`] ?? "";

    if (!planId) {
      throw new Error(`DLOCAL_PLAN_ID_${input.plan.toUpperCase()} no configurado`);
    }

    const payload: DLocalPaymentRequest = {
      amount,
      currency: CURRENCY,
      country: COUNTRY,
      description: `Turnio ${input.plan} — suscripción mensual`,
      order_id: `${input.businessId}-${Date.now()}`,
      notification_url: `${process.env.API_URL}/api/webhooks/dlocal`,
      success_url: input.successUrl,
      back_url: input.cancelUrl,
      payer: {
        name: input.nombre,
        email: input.email,
      },
      subscription: {
        plan_id: planId,
        description: `Plan ${input.plan}`,
      },
    };

    logger.info("dLocal createSubscription", {
      businessId: input.businessId,
      plan: input.plan,
      amount,
    });

    const res = await fetch(`${DLOCAL_API}/v1/payments`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await parseResponse<DLocalPaymentResponse>(
      res,
      "createSubscription",
      { businessId: input.businessId },
    );

    const checkoutUrl =
      data.next_action?.redirect_to_url?.url ?? data.redirect_url;

    if (!checkoutUrl) {
      throw new Error("dLocal no devolvió una URL de checkout");
    }

    if (!data.subscription_id) {
      throw new Error("dLocal no devolvió un subscription_id");
    }

    // next_charge_at no viene en el primer pago — calculamos 30 días
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    return {
      subscriptionId: data.subscription_id,
      checkoutUrl,
      nextBillingDate: nextBillingDate.toISOString(),
    };
  },

  async cancelSubscription(subscriptionId: string): Promise<void> {
    logger.info("dLocal cancelSubscription", { subscriptionId });

    const res = await fetch(
      `${DLOCAL_API}/v1/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        headers: buildHeaders(),
      },
    );

    if (!res.ok && res.status !== 404) {
      const body = (await res.json()) as DLocalErrorResponse;
      logger.error("dLocal cancelSubscription error", {
        subscriptionId,
        status: res.status,
        message: body.message,
      });
      throw new Error(`dLocal error [${body.code}]: ${body.message}`);
    }
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionDetails> {
    const res = await fetch(
      `${DLOCAL_API}/v1/subscriptions/${subscriptionId}`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    );

    const data = await parseResponse<DLocalSubscriptionResponse>(
      res,
      "getSubscription",
      { subscriptionId },
    );

    return {
      subscriptionId: data.id,
      status: mapDLocalStatus(data.status),
      nextBillingDate: data.next_charge_at,
    };
  },
};

// ── Mapeo de estados ──────────────────────────────────────────────────────────

function mapDLocalStatus(
  status: DLocalSubscriptionResponse["status"],
): SubscriptionDetails["status"] {
  switch (status) {
    case "ACTIVE":    return "active";
    case "PAUSED":    return "paused";
    case "PAST_DUE":  return "paused"; // tratamos past_due como paused hasta webhook
    case "CANCELED":  return "canceled";
  }
}
