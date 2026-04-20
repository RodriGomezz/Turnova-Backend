import { Subscription } from "./entities/Subscription";
import { getPlanLimits } from "./plan-limits";

export function hasActiveTrial(trialEndsAt: string | null): boolean {
  return !!trialEndsAt && new Date(trialEndsAt) > new Date();
}

export function canUseCustomDomain(
  plan: string,
  _trialEndsAt: string | null,
): boolean {
  return getPlanLimits(plan, false).customDomain;
}

export function shouldDegradeExpiredGracePeriod(
  subscription: Subscription,
  now = new Date(),
): boolean {
  return (
    subscription.status === "grace_period" &&
    !!subscription.grace_period_ends_at &&
    new Date(subscription.grace_period_ends_at) <= now
  );
}

export function shouldDegradeEndedCanceledSubscription(
  subscription: Subscription,
  now = new Date(),
): boolean {
  return (
    subscription.status === "canceled" &&
    !!subscription.current_period_end &&
    new Date(subscription.current_period_end) <= now
  );
}
