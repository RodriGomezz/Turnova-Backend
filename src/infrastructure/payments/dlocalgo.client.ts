import { logger } from "../logger";
import {
  CreateCheckoutResult,
  ExecutionDetails,
  IPaymentProvider,
  SubscriptionDetails,
} from "../../application/ports/IPaymentProvider";
import { SubscriptionPlan } from "../../domain/entities/Subscription";
import { PLAN_PRICES, PLAN_NAMES } from "../../domain/plan-prices";

// ── Tipos internos de dLocal Go ───────────────────────────────────────────────

interface DLocalGoPlan {
  id: number;
  merchant_id: number;
  name: string;
  description: string;
  country: string;
  currency: string;
  amount: number;
  frequency_type: string;
  frequency_value: number;
  active: boolean;
  free_trial_days: number;
  plan_token: string;
  subscribe_url: string;
  notification_url: string | null;
  back_url: string | null;
  success_url: string | null;
  error_url: string | null;
  created_at: string;
  updated_at: string;
}

interface DLocalGoSubscription {
  id: number;
  subscription_token: string;
  status: "CREATED" | "CONFIRMED";
  active: boolean;
  scheduled_date: string | null;
  client_email: string | null;
  plan: DLocalGoPlan;
}

interface DLocalGoExecution {
  id: number;
  status: "PENDING" | "COMPLETED" | "DECLINED";
  order_id: string;
  currency: string;
  amount_paid: number;
}

interface DLocalGoErrorResponse {
  code?: string | number;
  message?: string;
  error?: string;
}

interface DLocalGoPagedResponse<T> {
  data: T[];
  total_elements: number;
  total_pages: number;
  page: number;
  number_of_elements: number;
  size: number;
}

// ── Configuración ─────────────────────────────────────────────────────────────

const COUNTRY = "UY";
const CURRENCY = "UYU";
const FREQUENCY_TYPE = "MONTHLY";
const FREQUENCY_VALUE = 1;

function getBaseUrl(): string {
  return process.env.DLOCAL_SANDBOX === "true"
    ? "https://api-sbx.dlocalgo.com"
    : "https://api.dlocalgo.com";
}

function getAuthHeader(): string {
  const apiKey = process.env.DLOCAL_API_KEY ?? "";
  const secretKey = process.env.DLOCAL_SECRET_KEY ?? "";

  if (!apiKey || !secretKey) {
    throw new Error(
      "Faltan credenciales de dLocal Go. Configura DLOCAL_API_KEY y DLOCAL_SECRET_KEY.",
    );
  }

  return `Bearer ${apiKey}:${secretKey}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function parseResponse<T>(
  res: Response,
  operation: string,
  context: Record<string, unknown> = {},
): Promise<T> {
  const text = await res.text();
  let body: Record<string, unknown>;

  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    logger.error(`dLocal Go ${operation}: respuesta no es JSON`, { text, ...context });
    throw new Error(`dLocal Go error: respuesta invalida (${res.status})`);
  }

  if (!res.ok) {
    const err = body as unknown as DLocalGoErrorResponse;
    const code = err.code ?? res.status;
    const message = err.message ?? err.error ?? "Error desconocido";
    logger.error(`dLocal Go ${operation} error`, {
      ...context,
      status: res.status,
      code,
      message,
    });
    throw new Error(`dLocal Go [${code}]: ${message}`);
  }

  return body as T;
}

// ── Cliente dLocal Go ─────────────────────────────────────────────────────────

export const dlocalGoClient: IPaymentProvider = {
  async getOrCreatePlan(
    plan: SubscriptionPlan,
    notificationUrl: string,
    successUrl: string,
    backUrl: string,
    errorUrl: string,
  ): Promise<CreateCheckoutResult> {
    const base = getBaseUrl();
    const auth = getAuthHeader();
    const amount = PLAN_PRICES[plan];
    const planName = PLAN_NAMES[plan];

    // 1. Buscar si ya existe un plan activo para este tier
    logger.info("dLocal Go: buscando planes existentes", { plan });

    const listRes = await fetch(
      `${base}/v1/subscription/plan/all?page=1&page_size=50`,
      { headers: { Authorization: auth, "Content-Type": "application/json" } },
    );

    const listData = await parseResponse<DLocalGoPagedResponse<DLocalGoPlan>>(
      listRes,
      "listPlans",
      { plan },
    );

    const existing = listData.data.find(
      (p) =>
        p.active &&
        p.name === planName &&
        p.currency === CURRENCY &&
        p.amount === amount &&
        p.frequency_type === FREQUENCY_TYPE &&
        p.frequency_value === FREQUENCY_VALUE,
    );

    if (existing) {
      logger.info("dLocal Go: plan existente encontrado", {
        planId: existing.id,
        planToken: existing.plan_token,
      });
      return {
        planToken: existing.plan_token,
        subscribeUrl: existing.subscribe_url,
        dlocalPlanId: existing.id,
      };
    }

    // 2. Crear el plan si no existe
    logger.info("dLocal Go: creando nuevo plan", { plan, amount });

    const body = JSON.stringify({
      name: planName,
      description: `Turnova ${planName} - Facturación mensual`,
      country: COUNTRY,
      currency: CURRENCY,
      amount,
      frequency_type: FREQUENCY_TYPE,
      frequency_value: FREQUENCY_VALUE,
      notification_url: notificationUrl,
      success_url: successUrl,
      back_url: backUrl,
      error_url: errorUrl,
    });

    const createRes = await fetch(`${base}/v1/subscription/plan`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body,
    });

    const created = await parseResponse<DLocalGoPlan>(createRes, "createPlan", { plan });

    logger.info("dLocal Go: plan creado", {
      planId: created.id,
      planToken: created.plan_token,
    });

    return {
      planToken: created.plan_token,
      subscribeUrl: created.subscribe_url,
      dlocalPlanId: created.id,
    };
  },

  async cancelSubscription(planId: number, subscriptionId: number): Promise<void> {
    logger.info("dLocal Go: cancelando suscripción", { planId, subscriptionId });

    const res = await fetch(
      `${getBaseUrl()}/v1/subscription/plan/${planId}/subscription/${subscriptionId}/deactivate`,
      {
        method: "PATCH",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok && res.status !== 404) {
      await parseResponse(res, "cancelSubscription", { planId, subscriptionId });
    }

    logger.info("dLocal Go: suscripción cancelada", { planId, subscriptionId });
  },

  async getSubscription(
    planId: number,
    subscriptionId: number,
  ): Promise<SubscriptionDetails> {
    logger.info("dLocal Go: consultando suscripción", { planId, subscriptionId });

    const res = await fetch(
      `${getBaseUrl()}/v1/subscription/plan/${planId}/subscription/all?page=1&page_size=100`,
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      },
    );

    const data = await parseResponse<DLocalGoPagedResponse<DLocalGoSubscription>>(
      res,
      "getSubscription",
      { planId, subscriptionId },
    );

    const sub = data.data.find((s) => s.id === subscriptionId);

    if (!sub) {
      throw new Error(`Suscripción ${subscriptionId} no encontrada en plan ${planId}`);
    }

    return {
      subscriptionId: sub.id,
      subscriptionToken: sub.subscription_token,
      status: sub.status,
      active: sub.active,
      scheduledDate: sub.scheduled_date,
      clientEmail: sub.client_email,
    };
  },

  async getExecution(
    subscriptionId: number,
    executionId: string,
  ): Promise<ExecutionDetails> {
    logger.info("dLocal Go: consultando ejecución", { subscriptionId, executionId });

    const res = await fetch(
      `${getBaseUrl()}/v1/subscription/${subscriptionId}/execution/${executionId}`,
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
      },
    );

    const data = await parseResponse<DLocalGoExecution>(res, "getExecution", {
      subscriptionId,
      executionId,
    });

    return {
      executionId: data.id,
      orderId: data.order_id,
      status: data.status,
      currency: data.currency,
      amountPaid: data.amount_paid,
    };
  },
};
