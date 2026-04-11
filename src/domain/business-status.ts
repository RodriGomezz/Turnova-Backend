export type BusinessStatus = "active" | "trial" | "trial_expired" | "paused";

export function getBusinessStatus(business: {
  plan: string;
  trial_ends_at: string | null;
  activo: boolean;
}): BusinessStatus {
  if (!business.activo) return "paused";

  const now = new Date();
  const trialEnd = business.trial_ends_at
    ? new Date(business.trial_ends_at)
    : null;

  if (trialEnd && trialEnd > now) return "trial";

  // Trial vencido sin suscripción activa = trial_expired
  if (business.plan === "starter" && trialEnd && trialEnd <= now) {
    return "trial_expired";
  }

  return "active";
}
