import assert from "node:assert/strict";
import test from "node:test";
import {
  HandleWebhookUseCase,
  DLocalGoWebhookPayload,
} from "../application/subscriptions/HandleWebhookUseCase";
import { ISubscriptionRepository } from "../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../application/ports/IEmailService";
import { IPaymentProvider, PaymentDetails } from "../application/ports/IPaymentProvider";
import { Subscription, SubscriptionStatus } from "../domain/entities/Subscription";
import { Business } from "../domain/entities/Business";

// ── Factories ─────────────────────────────────────────────────────────────────

const BUSINESS_ID = "biz_123";
const ORDER_ID    = `${BUSINESS_ID}_1700000000000`;
const PAY_ID      = "PAY_abc123";

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id:                     "sub_1",
    business_id:            BUSINESS_ID,
    plan:                   "pro",
    status:                 "pending",
    dlocal_subscription_id: ORDER_ID,
    dlocal_payment_id:      null,
    current_period_start:   null,
    current_period_end:     null,
    grace_period_ends_at:   null,
    canceled_at:            null,
    created_at:             "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id:                         BUSINESS_ID,
    nombre:                     "Barbería Test",
    email:                      "test@test.com",
    slug:                       "test",
    plan:                       "starter",
    trial_ends_at:              null,
    subscription_downgraded_at: null,
    activo:                     true,
    ...overrides,
  } as Business;
}

// ── Mock builders ─────────────────────────────────────────────────────────────

function makeRepo(sub: Subscription | null = null): ISubscriptionRepository {
  const updates: Array<{ id: string; status: SubscriptionStatus; extra: Partial<Subscription> }> = [];
  return {
    findById:                          async () => sub,
    findByBusinessId:                  async () => sub,
    findActiveByBusinessId:            async () => (sub?.status === "active" ? sub : null),
    findCurrentEffectiveByBusinessId:  async () => sub,
    findPendingByBusinessId:           async () => (sub?.status === "pending" ? sub : null),
    findByDlocalId:                    async (id) => (sub?.dlocal_subscription_id === id ? sub : null),
    findByPaymentId:                   async () => null,
    findExpiredGracePeriods:           async () => [],
    findEndedCanceledSubscriptions:    async () => [],
    findMostRecentPending:             async () => (sub?.status === "pending" ? sub : null),
    create:                            async (d) => ({ ...d, id: "sub_new", created_at: new Date().toISOString() }) as Subscription,
    updateStatus: async (id, status, extra = {}) => {
      updates.push({ id, status, extra });
      return { ...sub!, id, status, ...extra };
    },
    _updates: updates,
  } as unknown as ISubscriptionRepository;
}

function makeBusinessRepo(business: Business | null = buildBusiness()): IBusinessRepository {
  const updates: Array<{ id: string; data: Partial<Business> }> = [];
  return {
    findById:  async () => business,
    update:    async (id, data) => { updates.push({ id, data }); return { ...business!, ...data }; },
    _updates: updates,
  } as unknown as IBusinessRepository;
}

function makeEmailService(): IEmailService & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    sendPaymentConfirmation: async () => { calls.push("sendPaymentConfirmation"); },
    sendPaymentFailed:       async () => { calls.push("sendPaymentFailed"); },
    sendPaymentFailedGrace:  async () => { calls.push("sendPaymentFailedGrace"); },
    sendBookingConfirmation: async () => {},
    sendBookingNotification: async () => {},
    sendBookingReminder:     async () => {},
  } as unknown as IEmailService & { calls: string[] };
}

function makePaymentProvider(orderId: string | null = ORDER_ID): IPaymentProvider & { getPaymentDetailsCalls: string[] } {
  const calls: string[] = [];
  return {
    getPaymentDetailsCalls: calls,
    createSubscription:  async () => ({ subscriptionId: "", checkoutUrl: "", nextBillingDate: "" }),
    cancelSubscription:  async () => {},
    refundPayment:       async () => {},
    getSubscription:     async () => ({ subscriptionId: "", status: "active", nextBillingDate: null }),
    getPaymentDetails:   async (paymentId: string): Promise<PaymentDetails> => {
      calls.push(paymentId);
      return { paymentId, orderId, status: "PAID" };
    },
  } as unknown as IPaymentProvider & { getPaymentDetailsCalls: string[] };
}

function makeUseCase(
  sub: Subscription | null,
  business?: Business | null,
  paymentOrderId: string | null = ORDER_ID,
) {
  const repo        = makeRepo(sub);
  const bizRepo     = makeBusinessRepo(business !== undefined ? business : buildBusiness());
  const email       = makeEmailService();
  const payment     = makePaymentProvider(paymentOrderId);
  const useCase     = new HandleWebhookUseCase(repo, bizRepo, email, payment);
  return { useCase, repo: repo as any, bizRepo: bizRepo as any, email, payment };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("PAID with order_id in payload — finds sub directly, no API call", async () => {
  const sub = buildSubscription();
  const { useCase, repo, email, payment } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "PAID", order_id: ORDER_ID });

  assert.equal(payment.getPaymentDetailsCalls.length, 0, "should NOT call getPaymentDetails when order_id present");
  assert.equal(repo._updates.length, 1);
  assert.equal(repo._updates[0].status, "active");
  assert.ok(email.calls.includes("sendPaymentConfirmation"));
});

test("PAID without order_id — calls getPaymentDetails to enrich payload, then activates", async () => {
  const sub = buildSubscription();
  const { useCase, repo, email, payment } = makeUseCase(sub);

  // Simulates the real dLocal Go bug: no order_id in webhook
  await useCase.execute({ id: PAY_ID, status: "PAID" });

  assert.equal(payment.getPaymentDetailsCalls.length, 1, "should call getPaymentDetails once");
  assert.equal(payment.getPaymentDetailsCalls[0], PAY_ID);
  assert.equal(repo._updates.length, 1);
  assert.equal(repo._updates[0].status, "active");
  assert.ok(email.calls.includes("sendPaymentConfirmation"));
});

test("PAID without order_id AND API returns no order_id — cannot safely resolve, no update", async () => {
  const sub = buildSubscription();
  const { useCase, repo } = makeUseCase(sub, undefined, null); // API returns null orderId

  await useCase.execute({ id: PAY_ID, status: "PAID" });

  // Without a businessId there is no safe way to find the subscription —
  // the code correctly skips rather than risk assigning the wrong business.
  assert.equal(repo._updates.length, 0, "should NOT update when orderId cannot be resolved");
});

test("PAID without order_id AND API throws — non-fatal, cannot resolve, no update", async () => {
  const sub = buildSubscription();
  const repo        = makeRepo(sub);
  const bizRepo     = makeBusinessRepo();
  const email       = makeEmailService();
  const brokenProvider: IPaymentProvider = {
    createSubscription:  async () => ({ subscriptionId: "", checkoutUrl: "", nextBillingDate: "" }),
    cancelSubscription:  async () => {},
    refundPayment:       async () => {},
    getSubscription:     async () => ({ subscriptionId: "", status: "active", nextBillingDate: null }),
    getPaymentDetails:   async () => { throw new Error("dLocal API timeout"); },
  };
  const useCase = new HandleWebhookUseCase(repo, bizRepo, email, brokenProvider);

  // Should not throw even when the API is down
  await assert.doesNotReject(() =>
    useCase.execute({ id: PAY_ID, status: "PAID" })
  );

  // No businessId derivable => cannot safely find sub => correct to skip
  assert.equal((repo as any)._updates.length, 0, "should not update when API fails and no order_id");
});

test("PAID — updates business.plan and clears trial_ends_at", async () => {
  const sub = buildSubscription({ status: "pending" });
  const biz = buildBusiness({ plan: "starter", trial_ends_at: "2099-01-01T00:00:00.000Z" });
  const { useCase, bizRepo } = makeUseCase(sub, biz);

  await useCase.execute({ id: PAY_ID, status: "PAID", order_id: ORDER_ID });

  const update = bizRepo._updates.find((u: any) => u.data.plan === "pro");
  assert.ok(update, "should update business.plan to pro");
  assert.equal(update.data.trial_ends_at, null);
  assert.equal(update.data.subscription_downgraded_at, null);
});

test("PAID — no business update when plan already matches and no trial", async () => {
  const sub = buildSubscription({ status: "pending" });
  const biz = buildBusiness({ plan: "pro", trial_ends_at: null, subscription_downgraded_at: null });
  const { useCase, bizRepo } = makeUseCase(sub, biz);

  await useCase.execute({ id: PAY_ID, status: "PAID", order_id: ORDER_ID });

  assert.equal(bizRepo._updates.length, 0, "should NOT update business when plan already correct");
});

test("REJECTED on pending subscription — cancels it", async () => {
  const sub = buildSubscription({ status: "pending" });
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "REJECTED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "canceled");
});

test("REJECTED on active subscription — moves to past_due", async () => {
  const sub = buildSubscription({ status: "active" });
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "REJECTED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "past_due");
});

test("REJECTED on past_due subscription — moves to grace_period and sets grace date", async () => {
  const sub = buildSubscription({
    status: "past_due",
    current_period_end: new Date(Date.now() + 86400000).toISOString(),
  });
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "REJECTED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "grace_period");
  assert.ok(repo._updates[0].extra.grace_period_ends_at, "should set grace_period_ends_at");
});

test("REJECTED on grace_period subscription — does nothing (already in grace)", async () => {
  const sub = buildSubscription({ status: "grace_period" });
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "REJECTED", order_id: ORDER_ID });

  assert.equal(repo._updates.length, 0, "should NOT update when already in grace_period");
});

test("CANCELLED — sets subscription to canceled", async () => {
  const sub = buildSubscription({ status: "active" });
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "CANCELLED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "canceled");
});

test("REFUNDED on pending — cancels subscription", async () => {
  const sub = buildSubscription({ status: "pending" });
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "REFUNDED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "canceled");
});

test("REFUNDED on active — expires subscription and degrades business to starter", async () => {
  const sub = buildSubscription({ status: "active" });
  const biz = buildBusiness({ plan: "pro" });
  const { useCase, repo, bizRepo } = makeUseCase(sub, biz);

  await useCase.execute({ id: PAY_ID, status: "REFUNDED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "expired");
  const bizUpdate = bizRepo._updates[0];
  assert.equal(bizUpdate.data.plan, "starter");
  assert.ok(bizUpdate.data.subscription_downgraded_at);
});

test("Webhook with no matching subscription — does nothing, no throw", async () => {
  const { useCase, repo } = makeUseCase(null, null, null);

  await assert.doesNotReject(() =>
    useCase.execute({ id: PAY_ID, status: "PAID" })
  );

  assert.equal(repo._updates.length, 0);
});

test("PENDING status — no DB updates, just logs", async () => {
  const sub = buildSubscription();
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "PENDING", order_id: ORDER_ID });

  assert.equal(repo._updates.length, 0);
});

test("normalizeStatus handles APPROVED as PAID", async () => {
  const sub = buildSubscription();
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "APPROVED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "active");
});

test("normalizeStatus handles AUTHORIZED as PAID", async () => {
  const sub = buildSubscription();
  const { useCase, repo } = makeUseCase(sub);

  await useCase.execute({ id: PAY_ID, status: "AUTHORIZED", order_id: ORDER_ID });

  assert.equal(repo._updates[0].status, "active");
});

test("Payload without order_id and API returns correct orderId — activates correct business", async () => {
  const sub = buildSubscription({ business_id: BUSINESS_ID });
  const biz = buildBusiness({ id: BUSINESS_ID, plan: "starter" });
  const { useCase, repo, bizRepo } = makeUseCase(sub, biz, ORDER_ID);

  await useCase.execute({ id: PAY_ID, status: "PAID" }); // no order_id

  // Sub activated
  assert.equal(repo._updates[0].status, "active");
  // Business upgraded
  const planUpdate = bizRepo._updates.find((u: any) => u.data.plan === "pro");
  assert.ok(planUpdate, "business plan should be updated to pro");
});