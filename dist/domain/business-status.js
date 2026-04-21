"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusinessStatus = getBusinessStatus;
function getBusinessStatus(business) {
    if (!business.activo)
        return "paused";
    const now = new Date();
    const trialEnd = business.trial_ends_at
        ? new Date(business.trial_ends_at)
        : null;
    if (trialEnd && trialEnd > now)
        return "trial";
    // Trial vencido sin suscripción activa = trial_expired
    if (business.plan === "starter" && trialEnd && trialEnd <= now) {
        return "trial_expired";
    }
    return "active";
}
//# sourceMappingURL=business-status.js.map