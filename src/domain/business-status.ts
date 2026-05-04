export type BusinessStatus =
  | "active"
  | "trial"
  | "trial_expired"
  | "subscription_expired"
  | "paused";

export function getBusinessStatus(business: {
  plan: string;
  trial_ends_at: string | null;
  activo: boolean;
  subscription_active?: boolean;
  subscription_ends_at?: string | null;
  subscription_downgraded_at?: string | null;
}): BusinessStatus {
  if (!business.activo) return "paused";

  const now = new Date();
  const trialEnd = business.trial_ends_at
    ? new Date(business.trial_ends_at)
    : null;

  if (trialEnd && trialEnd > now) return "trial";

  if (trialEnd && trialEnd <= now && business.plan === "starter") {
    return "trial_expired";
  }

  if (business.subscription_active) {
    return "active";
  }

  if (
    business.subscription_ends_at &&
    new Date(business.subscription_ends_at) <= now
  ) {
    return "subscription_expired";
  }

  if (
    business.plan === "starter" &&
    business.subscription_downgraded_at
  ) {
    return "subscription_expired";
  }

  return "active";
}
