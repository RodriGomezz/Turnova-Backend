export type SubscriptionStatus =
  | "pending"      // checkout iniciado, usuario todavía no completó el pago
  | "active"       // suscripción confirmada y vigente
  | "past_due"     // primer cobro fallido — dLocal Go reintentará
  | "grace_period" // segundo cobro fallido — período de gracia activo
  | "canceled"     // cancelada manualmente (acceso hasta fin de período)
  | "expired";     // período terminado o gracia vencida

export type SubscriptionPlan = "starter" | "pro" | "business";

export interface Subscription {
  id: string;
  business_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;

  // ── IDs de dLocal Go ──────────────────────────────────────────────────────
  /** ID numérico del plan en dLocal Go */
  dlocal_plan_id: number | null;
  /** plan_token de dLocal Go (usado para construir subscribe_url) */
  dlocal_plan_token: string | null;
  /** ID numérico de la suscripción en dLocal Go (disponible tras el primer pago) */
  dlocal_subscription_id: number | null;
  /** subscription_token de dLocal Go */
  dlocal_subscription_token: string | null;
  /** ID/order_id de la última ejecución (cobro) */
  dlocal_last_execution_id: string | null;

  // ── Datos del suscriptor ──────────────────────────────────────────────────
  payer_email: string | null;

  // ── Período de facturación ────────────────────────────────────────────────
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  canceled_at: string | null;

  created_at: string;
}
