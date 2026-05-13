import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseCustomDomain,
  hasActiveTrial,
  shouldDegradeEndedCanceledSubscription,
  shouldDegradeExpiredGracePeriod,
} from "../domain/subscription-access";
import { getBusinessStatus } from "../domain/business-status";
import { Subscription } from "../domain/entities/Subscription";

function buildSubscription(
  overrides: Partial<Subscription> = {},
): Subscription {
  return {
    id: "sub_1",
    business_id: "business_1",
    plan: "pro",
    status: "active",
    dlocal_plan_id: 123,
    dlocal_plan_token: "plan_tok_1",
    dlocal_subscription_id: 456,
    dlocal_subscription_token: "sub_tok_1",
    dlocal_last_execution_id: "exec_1",
    payer_email: "test@example.com",
    current_period_start: "2026-04-01T00:00:00.000Z",
    current_period_end: "2026-05-01T00:00:00.000Z",
    grace_period_ends_at: null,
    canceled_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

test("hasActiveTrial only returns true for a future date", () => {
  assert.equal(hasActiveTrial(null), false);
  assert.equal(hasActiveTrial("2026-04-01T00:00:00.000Z"), false);
  assert.equal(hasActiveTrial("2099-01-01T00:00:00.000Z"), true);
});

test("custom domains require a paid plan and are blocked during trial", () => {
  assert.equal(canUseCustomDomain("starter", "2099-01-01T00:00:00.000Z"), false);
  assert.equal(canUseCustomDomain("starter", null), true);
  assert.equal(canUseCustomDomain("pro", null), true);
  assert.equal(canUseCustomDomain("business", null), true);
});

test("grace period subscriptions degrade only after the grace date", () => {
  const now = new Date("2026-04-18T12:00:00.000Z");

  assert.equal(
    shouldDegradeExpiredGracePeriod(
      buildSubscription({
        status: "grace_period",
        grace_period_ends_at: "2026-04-18T11:59:59.000Z",
      }),
      now,
    ),
    true,
  );

  assert.equal(
    shouldDegradeExpiredGracePeriod(
      buildSubscription({
        status: "grace_period",
        grace_period_ends_at: "2026-04-18T12:00:01.000Z",
      }),
      now,
    ),
    false,
  );
});

test("canceled subscriptions degrade after the paid period ends", () => {
  const now = new Date("2026-04-18T12:00:00.000Z");

  assert.equal(
    shouldDegradeEndedCanceledSubscription(
      buildSubscription({
        status: "canceled",
        current_period_end: "2026-04-18T11:59:59.000Z",
      }),
      now,
    ),
    true,
  );

  assert.equal(
    shouldDegradeEndedCanceledSubscription(
      buildSubscription({
        status: "canceled",
        current_period_end: "2026-04-18T12:00:01.000Z",
      }),
      now,
    ),
    false,
  );
});

test("getBusinessStatus returns subscription_expired for downgraded starter", () => {
  const downgraded = {
    plan: "starter",
    trial_ends_at: null,
    activo: true,
    subscription_downgraded_at: "2026-04-01T00:00:00.000Z",
  };
  assert.equal(getBusinessStatus(downgraded as any), "subscription_expired");
});

test("getBusinessStatus returns active for original starter", () => {
  const originalStarter = {
    plan: "starter",
    trial_ends_at: null,
    activo: true,
    subscription_downgraded_at: null,
  };
  assert.equal(getBusinessStatus(originalStarter as any), "active");
});

test("getBusinessStatus returns active after reactivation", () => {
  const reactivated = {
    plan: "pro",
    trial_ends_at: null,
    activo: true,
    subscription_downgraded_at: null,
  };
  assert.equal(getBusinessStatus(reactivated as any), "active");
});
