export type SubscriptionStatus =
  | "pending"        // checkout iniciado, pago todavía no confirmado
  | "active"         // pago al día
  | "past_due"       // pago falló, dLocal reintentando
  | "grace_period"   // reintentos agotados, 7 días de gracia antes de degradar
  | "canceled"       // cancelado por el usuario
  | "expired";       // gracia expirada — plan degradado a Starter
  
export type SubscriptionPlan = "starter" | "pro" | "business";

export interface Subscription {
  id: string;
  business_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  dlocal_subscription_id: string;
  dlocal_payment_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  canceled_at: string | null;
  created_at: string;
}