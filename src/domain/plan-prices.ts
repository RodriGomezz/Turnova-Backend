import { SubscriptionPlan } from "./entities/Subscription";

/** Precios en UYU — fuente única de verdad */
export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  starter: 590,
  pro: 1390,
  business: 2290,
};

/** Nombres de plan tal como se crean en dLocal Go */
export const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  starter: "Turnova Starter",
  pro: "Turnova Pro",
  business: "Turnova Business",
};
