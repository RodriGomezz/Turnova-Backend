"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasActiveTrial = hasActiveTrial;
exports.canUseCustomDomain = canUseCustomDomain;
exports.shouldDegradeExpiredGracePeriod = shouldDegradeExpiredGracePeriod;
exports.shouldDegradeEndedCanceledSubscription = shouldDegradeEndedCanceledSubscription;
const plan_limits_1 = require("./plan-limits");
function hasActiveTrial(trialEndsAt) {
    return !!trialEndsAt && new Date(trialEndsAt) > new Date();
}
function canUseCustomDomain(plan, _trialEndsAt) {
    return (0, plan_limits_1.getPlanLimits)(plan, false).customDomain;
}
function shouldDegradeExpiredGracePeriod(subscription, now = new Date()) {
    return (subscription.status === "grace_period" &&
        !!subscription.grace_period_ends_at &&
        new Date(subscription.grace_period_ends_at) <= now);
}
function shouldDegradeEndedCanceledSubscription(subscription, now = new Date()) {
    return (subscription.status === "canceled" &&
        !!subscription.current_period_end &&
        new Date(subscription.current_period_end) <= now);
}
//# sourceMappingURL=subscription-access.js.map