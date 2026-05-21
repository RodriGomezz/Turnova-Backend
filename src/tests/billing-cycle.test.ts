import assert from "node:assert/strict";
import test from "node:test";
import { HandleWebhookUseCase } from "../application/subscriptions/HandleWebhookUseCase";
import { IEmailService } from "../application/ports/IEmailService";
import { Business } from "../domain/entities/Business";
import { Subscription, SubscriptionStatus } from "../domain/entities/Subscription";
import { IBusinessRepository } from "../domain/interfaces/IBusinessRepository";
import { ISubscriptionRepository } from "../domain/interfaces/ISubscriptionRepository";

// ── Builders ─────────────────────────────────────────────────────────────────

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    business_id: "biz_1",
    plan: "pro",
    status: "pending",
    billing_cycle: "monthly",
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
    id: "biz_1",
    nombre: "Test Business",
    slug: "test-business",
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
    tipo_negocio: "barberia",
    dias_anticipacion: 7,
    ciudad: null,
    pais: null,
    fotos_galeria: null,
    faq_items: null,
    ...overrides,
  } as Business;
}

function makeRepo(sub: Subscription | null) {
  const updates: Array<{ id: string; status: SubscriptionStatus; extra: Partial<Subscription> }> = [];
  const repo: ISubscriptionRepository = {
    findById: async (id) => (sub?.id === id ? sub : null),
    findByBusinessId: async () => sub,
    findActiveByBusinessId: async () => (sub?.status === "active" ? sub : null),
    findCurrentEffectiveByBusinessId: async () => sub,
    findPendingByBusinessId: async () => (sub?.status === "pending" ? sub : null),
    findByPlanToken: async (token) => (sub?.dlocal_plan_token === token ? sub : null),
    findBySubscriptionToken: async (token) => (sub?.dlocal_subscription_token === token ? sub : null),
    findByExecutionId: async (id) => (sub?.dlocal_last_execution_id === id ? sub : null),
    findExpiredGracePeriods: async () => [],
    findEndedCanceledSubscriptions: async () => [],
    create: async () => { throw new Error("not used"); },
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
    create: async () => { throw new Error("not used"); },
    update: async (id, data) => { updates.push({ id, data }); return { ...business!, ...data }; },
    delete: async () => {},
  };
  return { repo, updates };
}

function makeEmailService() {
  const calls: string[] = [];
  return {
    calls,
    sendPaymentConfirmation: async () => { calls.push("sendPaymentConfirmation"); },
    sendPaymentFailed: async () => { calls.push("sendPaymentFailed"); },
    sendPaymentFailedGrace: async () => { calls.push("sendPaymentFailedGrace"); },
    sendBookingConfirmation: async () => {},
    sendBookingNotification: async () => {},
    sendBookingReminder: async () => {},
  } as IEmailService & { calls: string[] };
}

// ── Tests de período mensual ─────────────────────────────────────────────────

test("FEAT-002: pago exitoso mensual genera período de ~30 días", async () => {
  const before = new Date();
  const sub = buildSubscription({ billing_cycle: "monthly" });
  const { repo, updates } = makeRepo(sub);
  const { repo: bizRepo } = makeBusinessRepo(buildBusiness());
  const email = makeEmailService();
  const uc = new HandleWebhookUseCase(repo, bizRepo, email);

  await uc.execute({ externalId: sub.id, invoiceId: "inv_monthly" });

  assert.equal(updates[0].status, "active");
  const start = new Date(updates[0].extra.current_period_start!);
  const end   = new Date(updates[0].extra.current_period_end!);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  assert.ok(diffDays >= 29 && diffDays <= 31, `Período mensual: ${diffDays} días (esperado ~30)`);
});

// ── Tests de período anual ───────────────────────────────────────────────────

test("FEAT-002: pago exitoso anual genera período de ~365 días", async () => {
  const sub = buildSubscription({ billing_cycle: "annual" });
  const { repo, updates } = makeRepo(sub);
  const { repo: bizRepo } = makeBusinessRepo(buildBusiness());
  const email = makeEmailService();
  const uc = new HandleWebhookUseCase(repo, bizRepo, email);

  await uc.execute({ externalId: sub.id, invoiceId: "inv_annual" });

  assert.equal(updates[0].status, "active");
  const start = new Date(updates[0].extra.current_period_start!);
  const end   = new Date(updates[0].extra.current_period_end!);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  assert.ok(diffDays >= 364 && diffDays <= 366, `Período anual: ${diffDays} días (esperado ~365)`);
});

test("FEAT-002: período anual es aproximadamente 12x el mensual", async () => {
  // Mensual
  const subM = buildSubscription({ id: "sub_m", billing_cycle: "monthly" });
  const { repo: repoM, updates: updM } = makeRepo(subM);
  const { repo: bizM } = makeBusinessRepo(buildBusiness({ id: "biz_1" }));
  await new HandleWebhookUseCase(repoM, bizM, makeEmailService()).execute({
    externalId: subM.id, invoiceId: "inv_m",
  });

  // Anual
  const subA = buildSubscription({ id: "sub_a", billing_cycle: "annual" });
  const { repo: repoA, updates: updA } = makeRepo(subA);
  const { repo: bizA } = makeBusinessRepo(buildBusiness({ id: "biz_1" }));
  await new HandleWebhookUseCase(repoA, bizA, makeEmailService()).execute({
    externalId: subA.id, invoiceId: "inv_a",
  });

  const monthlyDays = Math.round(
    (new Date(updM[0].extra.current_period_end!).getTime() -
     new Date(updM[0].extra.current_period_start!).getTime()) / (1000 * 60 * 60 * 24),
  );
  const annualDays = Math.round(
    (new Date(updA[0].extra.current_period_end!).getTime() -
     new Date(updA[0].extra.current_period_start!).getTime()) / (1000 * 60 * 60 * 24),
  );

  assert.ok(annualDays > monthlyDays * 11, `Anual (${annualDays}d) debe ser >> mensual (${monthlyDays}d)`);
});
