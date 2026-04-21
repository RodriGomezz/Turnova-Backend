"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const subscription_access_1 = require("../domain/subscription-access");
function buildSubscription(overrides = {}) {
    return {
        id: "sub_1",
        business_id: "business_1",
        plan: "pro",
        status: "active",
        dlocal_subscription_id: "dlocal_sub_1",
        dlocal_payment_id: null,
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        grace_period_ends_at: null,
        canceled_at: null,
        created_at: "2026-04-01T00:00:00.000Z",
        ...overrides,
    };
}
(0, node_test_1.default)("hasActiveTrial only returns true for a future date", () => {
    strict_1.default.equal((0, subscription_access_1.hasActiveTrial)(null), false);
    strict_1.default.equal((0, subscription_access_1.hasActiveTrial)("2026-04-01T00:00:00.000Z"), false);
    strict_1.default.equal((0, subscription_access_1.hasActiveTrial)("2099-01-01T00:00:00.000Z"), true);
});
(0, node_test_1.default)("custom domains require a paid plan and are blocked during trial", () => {
    strict_1.default.equal((0, subscription_access_1.canUseCustomDomain)("starter", "2099-01-01T00:00:00.000Z"), false);
    strict_1.default.equal((0, subscription_access_1.canUseCustomDomain)("starter", null), true);
    strict_1.default.equal((0, subscription_access_1.canUseCustomDomain)("pro", null), true);
    strict_1.default.equal((0, subscription_access_1.canUseCustomDomain)("business", null), true);
});
(0, node_test_1.default)("grace period subscriptions degrade only after the grace date", () => {
    const now = new Date("2026-04-18T12:00:00.000Z");
    strict_1.default.equal((0, subscription_access_1.shouldDegradeExpiredGracePeriod)(buildSubscription({
        status: "grace_period",
        grace_period_ends_at: "2026-04-18T11:59:59.000Z",
    }), now), true);
    strict_1.default.equal((0, subscription_access_1.shouldDegradeExpiredGracePeriod)(buildSubscription({
        status: "grace_period",
        grace_period_ends_at: "2026-04-18T12:00:01.000Z",
    }), now), false);
});
(0, node_test_1.default)("canceled subscriptions degrade after the paid period ends", () => {
    const now = new Date("2026-04-18T12:00:00.000Z");
    strict_1.default.equal((0, subscription_access_1.shouldDegradeEndedCanceledSubscription)(buildSubscription({
        status: "canceled",
        current_period_end: "2026-04-18T11:59:59.000Z",
    }), now), true);
    strict_1.default.equal((0, subscription_access_1.shouldDegradeEndedCanceledSubscription)(buildSubscription({
        status: "canceled",
        current_period_end: "2026-04-18T12:00:01.000Z",
    }), now), false);
});
//# sourceMappingURL=subscription-access.test.js.map