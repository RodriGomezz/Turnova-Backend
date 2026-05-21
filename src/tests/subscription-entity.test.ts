import assert from "node:assert/strict";
import test from "node:test";
import { Subscription, BillingCycle, SubscriptionPlan, SubscriptionStatus } from "../domain/entities/Subscription";

// Verifica que el tipo BillingCycle existe y acepta los valores correctos

test("BillingCycle acepta 'monthly' y 'annual'", () => {
  const monthly: BillingCycle = "monthly";
  const annual:  BillingCycle = "annual";
  assert.ok(monthly === "monthly");
  assert.ok(annual  === "annual");
});

test("Subscription incluye el campo billing_cycle", () => {
  const sub: Subscription = {
    id: "sub_1",
    business_id: "biz_1",
    plan: "pro",
    status: "active",
    billing_cycle: "annual",        // ← campo nuevo
    dlocal_plan_id: 1,
    dlocal_plan_token: "tok",
    dlocal_subscription_id: 2,
    dlocal_subscription_token: "sub_tok",
    dlocal_last_execution_id: "exec_1",
    payer_email: "a@b.com",
    current_period_start: "2026-01-01T00:00:00.000Z",
    current_period_end:   "2027-01-01T00:00:00.000Z",
    grace_period_ends_at: null,
    canceled_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(sub.billing_cycle, "annual");
});

test("SubscriptionStatus cubre todos los estados del ciclo de vida", () => {
  const estados: SubscriptionStatus[] = [
    "pending", "active", "past_due", "grace_period", "canceled", "expired",
  ];
  assert.equal(estados.length, 6);
});

test("SubscriptionPlan incluye los tres planes", () => {
  const planes: SubscriptionPlan[] = ["starter", "pro", "business"];
  assert.equal(planes.length, 3);
});
