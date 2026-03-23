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
  const tuvoTrial = trialEnd !== null;
  const trialActivo = trialEnd ? trialEnd > now : false;

  if (trialActivo) return "trial";
  if (business.plan === "starter" && tuvoTrial && !trialActivo)
    return "trial_expired";
  return "active";
}
