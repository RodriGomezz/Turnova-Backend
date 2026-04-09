export type SubscriptionStatus =
  | "active"       // pago al día
  | "past_due"     // pago falló, dLocal reintentando
  | "grace_period" // reintentos agotados, 5 días de gracia antes de degradar
  | "canceled"     // cancelado por el usuario
  | "expired";     // gracia expirada — plan degradado a Starter

export type SubscriptionPlan = "pro" | "business";

export interface Subscription {
  id: string;
  business_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** ID de la suscripción en dLocal Go */
  dlocal_subscription_id: string;
  /** ID del último pago procesado */
  dlocal_payment_id: string | null;
  current_period_start: string;
  current_period_end: string;
  /** current_period_end + GRACE_PERIOD_DAYS. Null si status no es grace_period */
  grace_period_ends_at: string | null;
  canceled_at: string | null;
  created_at: string;
}
