import { SubscriptionPlan } from "./entities/Subscription";
import type { BillingCycle } from "./entities/Subscription";

/** Período de prueba en días — fuente única de verdad */
export const TRIAL_DAYS = 14;

/** Precios mensuales en UYU — fuente única de verdad */
export const PLAN_PRICES_MONTHLY: Record<SubscriptionPlan, number> = {
  starter:  590,
  pro:     1390,
  business: 2990,
};

/** Precios anuales en UYU (equivale a ~10 cuotas mensuales) */
export const PLAN_PRICES_ANNUAL: Record<SubscriptionPlan, number> = {
  starter:   5_880,   // $490/mes equivalente
  pro:      13_800,   // $1.150/mes equivalente
  business: 29_880,   // oferta de lanzamiento
};

/** Para compatibilidad con el código existente que usa PLAN_PRICES */
export const PLAN_PRICES = PLAN_PRICES_MONTHLY;

/** Nombres de plan tal como se crean en dLocal Go — mensual */
export const PLAN_NAMES_MONTHLY: Record<SubscriptionPlan, string> = {
  starter:  "Kronu Starter Mensual",
  pro:      "Kronu Pro Mensual",
  business: "Kronu Business Mensual",
};

/** Nombres de plan tal como se crean en dLocal Go — anual */
export const PLAN_NAMES_ANNUAL: Record<SubscriptionPlan, string> = {
  starter:  "Kronu Starter Anual",
  pro:      "Kronu Pro Anual",
  business: "Kronu Business Anual",
};

/** @deprecated Usar PLAN_NAMES_MONTHLY */
export const PLAN_NAMES = PLAN_NAMES_MONTHLY;

// export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle): number {
//   return cycle === "annual" ? PLAN_PRICES_ANNUAL[plan] : PLAN_PRICES_MONTHLY[plan];
// }

// export function getPlanName(plan: SubscriptionPlan, cycle: BillingCycle): string {
//   return cycle === "annual" ? PLAN_NAMES_ANNUAL[plan] : PLAN_NAMES_MONTHLY[plan];
// }

/** Ahorro anual vs pagar 12 meses por separado */
export function annualSavings(plan: SubscriptionPlan): number {
  return PLAN_PRICES_MONTHLY[plan] * 12 - PLAN_PRICES_ANNUAL[plan];
}

/** Nombres de plan — daily (solo sandbox) */
export const PLAN_NAMES_DAILY: Record<SubscriptionPlan, string> = {
  starter:  "Kronu Starter Diario (TEST)",
  pro:      "Kronu Pro Diario (TEST)",
  business: "Kronu Business Diario (TEST)",
};

export function getPlanName(plan: SubscriptionPlan, cycle: BillingCycle): string {
  if (cycle === "annual") return PLAN_NAMES_ANNUAL[plan];
  if (cycle === "daily")  return PLAN_NAMES_DAILY[plan];
  return PLAN_NAMES_MONTHLY[plan];
}

export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle): number {
  if (cycle === "annual") return PLAN_PRICES_ANNUAL[plan];
  if (cycle === "daily")  return PLAN_PRICES_MONTHLY[plan]; // mismo precio, distinta frecuencia
  return PLAN_PRICES_MONTHLY[plan];
}