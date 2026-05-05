import assert from "node:assert/strict";
import test from "node:test";
import { HandleWebhookUseCase } from "../application/subscriptions/HandleWebhookUseCase";
import { IEmailService } from "../application/ports/IEmailService";
import { Business } from "../domain/entities/Business";
import { Subscription, SubscriptionStatus } from "../domain/entities/Subscription";
import { IBusinessRepository } from "../domain/interfaces/IBusinessRepository";
import { ISubscriptionRepository } from "../domain/interfaces/ISubscriptionRepository";

const BUSINESS_ID = "biz_123";

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    business_id: BUSINESS_ID,
    plan: "pro",
    status: "pending",
    dlocal_plan_id: 1001,
    dlocal_plan_token: "plan_tok_1",
    dlocal_subscription_id: null,
    dlocal_subscription_token: null,
    dlocal_last_execution_id: null,
    payer_email: "owner@test.com",
    current_period_start: null,
    current_period_end: null,
    grace_period_ends_at: null,
    canceled_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: BUSINESS_ID,
    nombre: "Barberia Test",
    slug: "barberia-test",
    email: "owner@test.com",
    plan: "starter",
    trial_ends_at: null,
    subscription_downgraded_at: null,
    activo: true,
    created_at: "2026-04-01T00:00:00.000Z",
    onboarding_completed: true,
    domain_verified: false,
    domain_verified_at: null,
    domain_added_at: null,
    logo_url: null,
    buffer_minutos: 15,
    auto_confirmar: true,
    frase_bienvenida: null,
    direccion: null,
    whatsapp: null,
    instagram: null,
    facebook: null,
    hero_imagen_url: null,
    color_acento: "#000000",
    color_fondo: "#ffffff",
    color_superficie: "#ffffff",
    tipografia: "clasica",
    estilo_cards: "destacado",
    termino_profesional: "Profesional",
    termino_profesional_plural: "Profesionales",
    termino_servicio: "Servicio",
    termino_reserva: "Reserva",
    horario_texto: null,
    custom_domain: null,
    ...overrides,
  } as Business;
}

function makeRepo(sub: Subscription | null) {
  const updates: Array<{
    id: string;
    status: SubscriptionStatus;
    extra: Partial<Subscription>;
  }> = [];

  const repo: ISubscriptionRepository = {
    findById: async (id) => (sub?.id === id ? sub : null),
    findByBusinessId: async () => sub,
    findActiveByBusinessId: async () => (sub?.status === "active" ? sub : null),
    findCurrentEffectiveByBusinessId: async () => sub,
    findPendingByBusinessId: async () => (sub?.status === "pending" ? sub : null),
    findByPlanToken: async (token) =>
      sub?.dlocal_plan_token === token ? sub : null,
    findBySubscriptionToken: async (token) =>
      sub?.dlocal_subscription_token === token ? sub : null,
    findByExecutionId: async (executionId) =>
      sub?.dlocal_last_execution_id === executionId ? sub : null,
    findExpiredGracePeriods: async () => [],
    findEndedCanceledSubscriptions: async () => [],
    create: async () => {
      throw new Error("not used");
    },
    updateStatus: async (id, status, extra = {}) => {
      updates.push({ id, status, extra });
      return { ...sub!, id, status, ...extra };
    },
  };

  return { repo, updates };
}

function makeBusinessRepo(business: Business | null) {
  const updates: Array<{ id: string; data: Partial<Business> }> = [];

  const repo: IBusinessRepository = {
    findById: async (id) => (business?.id === id ? business : null),
    findBySlug: async () => null,
    findByCustomDomain: async () => null,
    findByAnyCustomDomain: async () => null,
    create: async () => {
      throw new Error("not used");
    },
    update: async (id, data) => {
      updates.push({ id, data });
      return { ...business!, ...data };
    },
    delete: async () => {},
  };

  return { repo, updates };
}

function makeEmailService(): IEmailService & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    sendPaymentConfirmation: async () => {
      calls.push("sendPaymentConfirmation");
    },
    sendPaymentFailed: async () => {
      calls.push("sendPaymentFailed");
    },
    sendPaymentFailedGrace: async () => {
      calls.push("sendPaymentFailedGrace");
    },
    sendBookingConfirmation: async () => {},
    sendBookingNotification: async () => {},
    sendBookingReminder: async () => {},
  } as IEmailService & { calls: string[] };
}

test("activa la suscripcion por external_id y actualiza el negocio", async () => {
  const sub = buildSubscription();
  const business = buildBusiness();
  const { repo, updates } = makeRepo(sub);
  const { repo: businessRepo, updates: businessUpdates } = makeBusinessRepo(business);
  const email = makeEmailService();
  const useCase = new HandleWebhookUseCase(repo, businessRepo, email);

  await useCase.execute({
    externalId: sub.id,
    invoiceId: "exec_123",
    subscriptionId: 4321,
    status: "COMPLETED",
    client_email: "payer@test.com",
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "active");
  assert.equal(updates[0].extra.dlocal_subscription_id, 4321);
  assert.equal(updates[0].extra.dlocal_last_execution_id, "exec_123");
  assert.equal(updates[0].extra.payer_email, "payer@test.com");
  assert.equal(businessUpdates.length, 1);
  assert.equal(businessUpdates[0].data.plan, "pro");
  assert.ok(email.calls.includes("sendPaymentConfirmation"));
});

test("encuentra una renovacion por invoiceId cuando no viene external_id", async () => {
  const sub = buildSubscription({
    status: "active",
    dlocal_last_execution_id: "ST-plan-2",
  });
  const { repo, updates } = makeRepo(sub);
  const { repo: businessRepo } = makeBusinessRepo(buildBusiness({ plan: "pro" }));
  const email = makeEmailService();
  const useCase = new HandleWebhookUseCase(repo, businessRepo, email);

  await useCase.execute({
    invoiceId: "ST-plan-2",
    status: "PAID",
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "active");
});

test("mueve active a past_due cuando el cobro falla", async () => {
  const sub = buildSubscription({ status: "active" });
  const { repo, updates } = makeRepo(sub);
  const { repo: businessRepo } = makeBusinessRepo(buildBusiness({ plan: "pro" }));
  const email = makeEmailService();
  const useCase = new HandleWebhookUseCase(repo, businessRepo, email);

  await useCase.execute({
    external_id: sub.id,
    order_id: "exec_failed_1",
    status: "DECLINED",
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "past_due");
  assert.ok(email.calls.includes("sendPaymentFailed"));
});

test("mueve past_due a grace_period en el segundo fallo", async () => {
  const sub = buildSubscription({
    status: "past_due",
    current_period_end: "2026-05-01T00:00:00.000Z",
  });
  const { repo, updates } = makeRepo(sub);
  const { repo: businessRepo } = makeBusinessRepo(buildBusiness({ plan: "pro" }));
  const email = makeEmailService();
  const useCase = new HandleWebhookUseCase(repo, businessRepo, email);

  await useCase.execute({
    external_id: sub.id,
    order_id: "exec_failed_2",
    status: "REJECTED",
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "grace_period");
  assert.ok(updates[0].extra.grace_period_ends_at);
  assert.ok(email.calls.includes("sendPaymentFailedGrace"));
});

test("cancela suscripcion pendiente ante un fallo inicial", async () => {
  const sub = buildSubscription({ status: "pending" });
  const { repo, updates } = makeRepo(sub);
  const { repo: businessRepo } = makeBusinessRepo(buildBusiness());
  const email = makeEmailService();
  const useCase = new HandleWebhookUseCase(repo, businessRepo, email);

  await useCase.execute({
    external_id: sub.id,
    status: "FAILED",
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "canceled");
});

test("ignora webhooks que no puede vincular a una suscripcion", async () => {
  const { repo, updates } = makeRepo(null);
  const { repo: businessRepo } = makeBusinessRepo(null);
  const email = makeEmailService();
  const useCase = new HandleWebhookUseCase(repo, businessRepo, email);

  await assert.doesNotReject(() =>
    useCase.execute({ invoiceId: "exec_missing", status: "PAID" }),
  );

  assert.equal(updates.length, 0);
  assert.equal(email.calls.length, 0);
});
