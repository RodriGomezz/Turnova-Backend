import { SubscriptionPlan } from "./entities/Subscription";

/** Precios en UYU — fuente única de verdad */
export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  pro: 1390,
  business: 2290,
};
