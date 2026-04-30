import assert from "node:assert/strict";
import test from "node:test";
import { RenewDueSubscriptionsUseCase } from "../application/subscriptions/RenewDueSubscriptionsUseCase";
import { ISubscriptionRepository } from "../domain/interfaces/ISubscriptionRepository";
import { IPaymentProvider } from "../application/ports/IPaymentProvider";
import { Subscription } from "../domain/entities/Subscription";

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    business_id: "biz_1",
    plan: "pro",
    status: "active",
    dlocal_subscription_id: "biz_1_1700000000000",
    dlocal_payment_id: null,
    dlocal_card_id: "card_1",
    dlocal_card_brand: "VI",
    dlocal_card_last4: "1111",
    dlocal_network_tx_reference: "ref_1",
    payer_name: "Juan Perez",
    payer_email: "juan@test.com",
    payer_document: "12345678",
    last_renewal_attempt_at: null,
    current_period_start: "2026-03-01T00:00:00.000Z",
    current_period_end: "2026-04-01T00:00:00.000Z",
    grace_period_ends_at: null,
    canceled_at: null,
    created_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRepo(
  subscriptions: Subscription[],
): ISubscriptionRepository & { updates: Array<{ id: string; status: string; extra: Partial<Subscription> }> } {
  const updates: Array<{ id: string; status: string; extra: Partial<Subscription> }> = [];
  return {
    updates,
    findById: async () => subscriptions[0] ?? null,
    findByBusinessId: async () => subscriptions[0] ?? null,
    findActiveByBusinessId: async () => subscriptions[0] ?? null,
    findCurrentEffectiveByBusinessId: async () => subscriptions[0] ?? null,
    findPendingByBusinessId: async () => null,
    findByDlocalId: async () => subscriptions[0] ?? null,
    findByPaymentId: async () => subscriptions[0] ?? null,
    findExpiredGracePeriods: async () => [],
    findEndedCanceledSubscriptions: async () => [],
    findRenewalCandidates: async () => subscriptions,
    findMostRecentPending: async () => null,
    create: async () => subscriptions[0]!,
    updateStatus: async (
      id: string,
      status: any,
      extra: Partial<Subscription> = {},
    ) => {
      updates.push({ id, status, extra });
      return { ...subscriptions[0]!, status, ...extra };
    },
  } as unknown as ISubscriptionRepository & {
    updates: Array<{ id: string; status: string; extra: Partial<Subscription> }>;
  };
}

function makePaymentProvider(
  status: "active" | "pending" | "rejected",
): IPaymentProvider & { chargeCalls: number } {
  let chargeCalls = 0;
  return {
    get chargeCalls() {
      return chargeCalls;
    },
    createSubscription: async () => {
      throw new Error("not used");
    },
    chargeSavedCardSubscription: async () => {
      chargeCalls += 1;
      return {
        paymentId: "pay_renew_1",
        status,
        cardBrand: "VI",
        cardLast4: "1111",
        networkTxReference: "ref_new",
      };
    },
    cancelSubscription: async () => {},
    refundPayment: async () => {},
    getSubscription: async () => ({
      subscriptionId: "",
      status: "active",
      nextBillingDate: null,
    }),
    getPaymentDetails: async () => ({
      paymentId: "pay_renew_1",
      orderId: "biz_1_1700000000000",
      status: "PAID",
    }),
  };
}

function makeWebhookHandler() {
  const calls: Array<{ id?: string; order_id?: string; status?: string }> = [];
  return {
    calls,
    execute: async (payload: { id?: string; order_id?: string; status?: string }) => {
      calls.push(payload);
    },
  };
}

test("cobra suscripcion vencida y reusa la ruta PAID", async () => {
  const repo = makeRepo([buildSubscription()]);
  const paymentProvider = makePaymentProvider("active");
  const webhook = makeWebhookHandler();
  const useCase = new RenewDueSubscriptionsUseCase(
    repo,
    paymentProvider,
    webhook as any,
  );

  await useCase.execute(new Date("2026-04-29T12:00:00.000Z"));

  assert.equal(paymentProvider.chargeCalls, 1);
  assert.equal(repo.updates.length, 1);
  assert.equal(repo.updates[0].extra.dlocal_payment_id, "pay_renew_1");
  assert.equal(webhook.calls.length, 1);
  assert.equal(webhook.calls[0].status, "PAID");
});

test("si el cobro es rechazado, reusa la ruta REJECTED", async () => {
  const repo = makeRepo([buildSubscription({ status: "past_due" })]);
  const paymentProvider = makePaymentProvider("rejected");
  const webhook = makeWebhookHandler();
  const useCase = new RenewDueSubscriptionsUseCase(
    repo,
    paymentProvider,
    webhook as any,
  );

  await useCase.execute(new Date("2026-04-29T12:00:00.000Z"));

  assert.equal(paymentProvider.chargeCalls, 1);
  assert.equal(webhook.calls.length, 1);
  assert.equal(webhook.calls[0].status, "REJECTED");
});

test("omite renovacion automatica si falta card_id", async () => {
  const repo = makeRepo([buildSubscription({ dlocal_card_id: null })]);
  const paymentProvider = makePaymentProvider("active");
  const webhook = makeWebhookHandler();
  const useCase = new RenewDueSubscriptionsUseCase(
    repo,
    paymentProvider,
    webhook as any,
  );

  await useCase.execute(new Date("2026-04-29T12:00:00.000Z"));

  assert.equal(paymentProvider.chargeCalls, 0);
  assert.equal(repo.updates.length, 0);
  assert.equal(webhook.calls.length, 0);
});
