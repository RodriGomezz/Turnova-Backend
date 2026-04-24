export type BusinessStatus = "active" | "trial" | "trial_expired" | "subscription_expired" | "paused";

export function getBusinessStatus(business: {
  plan: string;
  trial_ends_at: string | null;
  activo: boolean;
  subscription_active?: boolean;
  subscription_ends_at?: string | null;
}): BusinessStatus {

  if (!business.activo) return "paused";

  const now = new Date();
  const trialEnd = business.trial_ends_at ? new Date(business.trial_ends_at) : null;

  // 1. trial activo
  if (trialEnd && trialEnd > now) return "trial";

  // 2. trial expirado
  if (trialEnd && trialEnd <= now && business.plan === "starter") {
    return "trial_expired";
  }

  // 3. suscripción activa REAL (no flag)
  if (business.subscription_active) {
    return "active";
  }

  // 4. suscripción vencida real
  if (business.subscription_ends_at && new Date(business.subscription_ends_at) <= now) {
    return "subscription_expired";
  }

  return "active";
}


