/**
 * MercadoPago Client — implementación de IPaymentProvider
 *
 * Flujo correcto para suscripciones con plan asociado:
 *
 *   1. getOrCreatePlan por tier (starter/pro/business) → preapproval_plan compartido
 *      El plan es uno por tier — todos los usuarios del mismo plan comparten el mismo
 *      preapproval_plan_id. El plan define el precio y frecuencia.
 *
 *   2. Crear preapproval individual → vincula al usuario con el plan.
 *      Incluye external_reference = nuestro subscriptionId interno (UUID).
 *      Devuelve su propio init_point para redirigir al usuario.
 *
 *   3. El usuario completa el checkout en MP → el preapproval queda en "authorized"
 *      cuando MP procesa el primer cobro.
 *
 *   4. MP envía webhooks:
 *      - type: "subscription_preapproval" → cambios de estado del preapproval
 *      - type: "payment" → cobros ejecutados (con external_reference en el pago)
 *
 * Docs:
 *   https://www.mercadopago.com/developers/es/docs/subscriptions/integration-configuration/subscription-associated-plan
 *   https://www.mercadopago.com/developers/es/reference/subscriptions/_preapproval_plan/post
 *   https://www.mercadopago.com/developers/es/reference/subscriptions/_preapproval/post
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

const MP_API_BASE      = "https://api.mercadopago.com";
const CURRENCY_ID      = "UYU";
const FREQUENCY        = 1;
const FREQUENCY_TYPE   = "months";

// ── Tipos internos ────────────────────────────────────────────────────────────

interface MPPreapprovalPlan {
  id: string;
  reason: string;
  status: "active" | "cancelled";
  init_point: string;
  back_url: string;
  auto_recurring: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
  date_created: string;
  last_modified: string;
}

interface MPPreapprovalPlanSearchResult {
  paging: { offset: number; limit: number; total: number };
  results: MPPreapprovalPlan[];
}

interface MPPreapproval {
  id: string;
  preapproval_plan_id?: string;
  external_reference?: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point: string;
  payer_id?: number;
  payer_email?: string;
  next_payment_date?: string;
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
    const err = body as MPErrorResponse;
    const cause = err.cause?.map((c) => `${c.code}: ${c.description}`).join("; ");
    const message = err.message ?? err.error ?? "Error desconocido";
    logger.error(`MP ${operation} error`, { ...context, status: res.status, message, cause });
    throw new Error(`MercadoPago [${res.status}]: ${message}${cause ? ` — ${cause}` : ""}`);
  }

  return body as T;
}

// ── Plan helpers ──────────────────────────────────────────────────────────────

async function findExistingPlan(
  planName: string,
  amount: number,
): Promise<MPPreapprovalPlan | null> {
  // Endpoint correcto: GET /preapproval_plan (sin /search)
  // Docs: https://www.mercadopago.com/developers/es/reference/subscriptions/_preapproval_plan/get
  const url = new URL(`${MP_API_BASE}/preapproval_plan`);
  url.searchParams.set("status", "active");
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", "0");

  const res = await fetch(url.toString(), { headers: mpHeaders() });

  if (!res.ok) {
    logger.warn("MP: búsqueda de planes falló, se creará uno nuevo", {
      status: res.status,
    });
    return null;
  }

  const data = (await res.json()) as MPPreapprovalPlanSearchResult;

  // results puede ser un array vacío si no hay planes — proteger contra undefined
  const results = Array.isArray(data.results) ? data.results : [];

  return (
    results.find(
      (p) =>
        p.status === "active" &&
        p.reason === planName &&
        p.auto_recurring.currency_id === CURRENCY_ID &&
        Number(p.auto_recurring.transaction_amount) === amount &&
        p.auto_recurring.frequency === FREQUENCY &&
        p.auto_recurring.frequency_type === FREQUENCY_TYPE,
    ) ?? null
  );
}

/**
 * MP exige que back_url sea una URL absoluta con dominio real (no localhost, no IPs).
 * Esta función la sanitiza antes de enviarla a la API.
 * En sandbox, MP acepta cualquier URL https:// válida — usamos una de fallback pública.
 */
function sanitizeBackUrl(raw: string): string {
  // Log siempre el valor raw para diagnóstico
  logger.info("MP: back_url recibida", { raw });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    logger.warn("MP: back_url no es una URL válida, usando fallback", { raw });
    return getMPFallbackUrl();
  }

  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname) ||
    parsed.hostname.endsWith(".local") ||
    parsed.hostname.endsWith(".localhost");

  if (isLocal) {
    const fallback = getMPFallbackUrl();
    logger.info("MP: back_url es localhost, usando fallback", { raw, fallback });
    return fallback;
  }

  // MP solo acepta http:// o https://
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    logger.warn("MP: back_url con protocolo inválido, usando fallback", { raw });
    return getMPFallbackUrl();
  }

  return raw;
}

function getMPFallbackUrl(): string {
  // Prioridad: MP_DEV_BACK_URL → MP_BACK_URL_FALLBACK → URL pública hardcodeada de MP
  const envFallback = process.env.MP_DEV_BACK_URL ?? process.env.FRONTEND_URL;
  if (envFallback) {
    try {
      const p = new URL(envFallback);
      const isLocal =
        p.hostname === "localhost" ||
        p.hostname === "127.0.0.1" ||
        p.hostname.endsWith(".local");
      if (!isLocal) return envFallback;
    } catch {
      // env mal formado, usar hardcoded
    }
  }
  // Fallback absoluto: página de MP que siempre existe (válida para sandbox y prod)
  return "https://www.mercadopago.com.uy";
}

async function ensurePlan(
  plan: SubscriptionPlan,
  backUrl: string,
): Promise<MPPreapprovalPlan> {
  const amount   = PLAN_PRICES[plan];
  const planName = PLAN_NAMES[plan];
  const safeBackUrl = sanitizeBackUrl(backUrl);

  const existing = await findExistingPlan(planName, amount);

  if (existing) {
    logger.info("MP: plan existente encontrado", { planId: existing.id, plan });

    // Actualizar back_url si cambió (p.ej. de localhost → producción)
    if (existing.back_url !== backUrl) {
      try {
        const patchRes = await fetch(`${MP_API_BASE}/preapproval_plan/${existing.id}`, {
          method:  "PUT",
          headers: mpHeaders(idemKey("patchPlan", existing.id)),
          body:    JSON.stringify({ back_url: backUrl }),
        });
        if (patchRes.ok) {
          const patched = (await patchRes.json()) as MPPreapprovalPlan;
          logger.info("MP: back_url del plan actualizada", { planId: existing.id });
          return patched;
        }
      } catch (err) {
        logger.warn("MP: no se pudo actualizar back_url del plan", {
          planId: existing.id,
          err,
        });
      }
    }

    return existing;
  }

  // Crear nuevo plan
  logger.info("MP: creando nuevo plan", { plan, amount });

  const createRes = await fetch(`${MP_API_BASE}/preapproval_plan`, {
    method:  "POST",
    headers: mpHeaders(idemKey("createPlan", plan)),
    body: JSON.stringify({
      reason: planName,
      auto_recurring: {
        frequency:          FREQUENCY,
        frequency_type:     FREQUENCY_TYPE,
        transaction_amount: amount,
        currency_id:        CURRENCY_ID,
      },
      back_url: backUrl,
    }),
  });

  const created = await parseResponse<MPPreapprovalPlan>(createRes, "createPlan", { plan });

  logger.info("MP: plan creado", { planId: created.id, initPoint: created.init_point });
  return created;
}

// ── Preapproval individual ────────────────────────────────────────────────────

async function createPreapproval(
  planId: string,
  externalReference: string,
  payerEmail: string | undefined,
  backUrl: string,
): Promise<MPPreapproval> {
  /**
   * POST /preapproval
   * Docs: https://www.mercadopago.com/developers/es/reference/subscriptions/_preapproval/post
   *
   * Campos relevantes:
   *   - preapproval_plan_id: el plan al que se suscribe
   *   - external_reference:  nuestro UUID interno → correlaciona webhooks
   *   - payer_email:         email del pagador (campo raíz, no dentro de payer{})
   *   - back_url:            URL a donde MP redirige tras el checkout
   *   - status: "pending"   → el usuario aún no autorizó el débito
   */
  const body: Record<string, unknown> = {
    preapproval_plan_id: planId,
    external_reference:  externalReference,
    back_url:            backUrl,
    status:              "pending",
  };

  // payer_email es un campo raíz en la API de MP (no anidado en payer:{})
  if (payerEmail) body["payer_email"] = payerEmail;

  logger.info("MP: creando preapproval (suscripción individual)", {
    planId,
    externalReference,
    hasPayerEmail: !!payerEmail,
  });

  const res = await fetch(`${MP_API_BASE}/preapproval`, {
    method:  "POST",
    headers: mpHeaders(idemKey("createPreapproval", externalReference)),
    body:    JSON.stringify(body),
  });

  const preapproval = await parseResponse<MPPreapproval>(res, "createPreapproval", {
    planId,
    externalReference,
  });

  logger.info("MP: preapproval creado", {
    preapprovalId: preapproval.id,
    initPoint:     preapproval.init_point,
    externalReference,
  });

  return preapproval;
}

// ── Cliente MercadoPago (implementa IPaymentProvider) ─────────────────────────

export const mercadoPagoClient: IPaymentProvider = {

  /**
   * 1. Obtiene o crea el preapproval_plan compartido del tier.
   * 2. Crea un preapproval individual para este usuario con external_reference.
   * 3. Devuelve el init_point del preapproval (no del plan) como subscribeUrl.
   *
   * El external_reference es el UUID de nuestra BD — cuando MP envíe el webhook
   * de pago, podremos encontrar la suscripción directamente sin joins.
   */
  async getOrCreatePlan(
    plan: SubscriptionPlan,
    _notificationUrl: string,  // Se configura en Dashboard MP, no vía API de plan
    _successUrl: string,       // MP no lo acepta en preapproval_plan (solo back_url)
    backUrl: string,
    _errorUrl: string,         // MP no tiene error_url
    externalReference?: string,
    payerEmail?: string,
  ): Promise<CreateCheckoutResult> {

    // Paso 1: plan compartido
    const mpPlan = await ensurePlan(plan, backUrl);

    // Paso 2: preapproval individual (requiere el externalReference)
    if (!externalReference) {
      throw new Error(
        "MP getOrCreatePlan: externalReference es requerido. " +
        "Pasá el subscriptionId de tu BD para correlacionar los webhooks.",
      );
    }

    const preapproval = await createPreapproval(
      mpPlan.id,
      externalReference,
      payerEmail,
      backUrl,
    );

    return {
      planToken:    mpPlan.id,            // preapproval_plan_id → se guarda en dlocal_plan_token
      subscribeUrl: preapproval.init_point, // URL del checkout del usuario específico
      dlocalPlanId: null,                 // No aplica en MP
    };
  },

  async cancelSubscription(_planId: number, subscriptionId: number): Promise<void> {
    // En MP, el subscriptionId almacenado en dlocal_subscription_id es el preapproval_id
    // Lo guardamos como number por compatibilidad de interfaz, pero MP usa strings.
    // Ver: HandleMPWebhookUseCase guarda el preapproval_id en dlocal_subscription_token.
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