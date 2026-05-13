import assert from "node:assert/strict";
import test from "node:test";
import { CreateSubscriptionUseCase } from "../application/subscriptions/CreateSubscriptionUseCase";
import { IPaymentProvider } from "../application/ports/IPaymentProvider";
import { Business } from "../domain/entities/Business";
import { Subscription } from "../domain/entities/Subscription";
import { IBusinessRepository } from "../domain/interfaces/IBusinessRepository";
import { ISubscriptionRepository } from "../domain/interfaces/ISubscriptionRepository";
import { SubscriptionController } from "../presentation/controllers/SubscriptionController";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      businessId?: string;
    }
  }
}

function buildBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: "biz_1",
    nombre: "Negocio Test",
    slug: "negocio-test",
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

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    business_id: "biz_1",
    plan: "pro",
    status: "pending",
    dlocal_plan_id: 1234,
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

test("create subscription permite re-suscribirse al mismo plan si la anterior esta cancelada", async () => {
  const latestCanceled = buildSubscription({
    status: "canceled",
    plan: "pro",
    current_period_end: "2099-01-01T00:00:00.000Z",
  });

  let canceledPendingId: string | null = null;
  let createdPayload: Omit<Subscription, "id" | "created_at"> | null = null;

  const subscriptionRepository: ISubscriptionRepository = {
    findById: async () => latestCanceled,
    findByBusinessId: async () => latestCanceled,
    findActiveByBusinessId: async () => null,
    findCurrentEffectiveByBusinessId: async () => latestCanceled,
    findPendingByBusinessId: async () => null,
    findByPlanToken: async () => null,
    findBySubscriptionToken: async () => null,
    findByExecutionId: async () => null,
    findExpiredGracePeriods: async () => [],
    findEndedCanceledSubscriptions: async () => [],
    create: async (data) => {
      createdPayload = data;
      return { ...data, id: "sub_new", created_at: "2026-05-05T00:00:00.000Z" };
    },
    updateStatus: async (id, status, extra = {}) => {
      canceledPendingId = `${id}:${status}`;
      return { ...latestCanceled, id, status, ...extra };
    },
  };

  const businessRepository: IBusinessRepository = {
    findById: async () => buildBusiness(),
    findBySlug: async () => null,
    findByCustomDomain: async () => null,
    findByAnyCustomDomain: async () => null,
    create: async () => {
      throw new Error("not used");
    },
    update: async () => buildBusiness(),
    delete: async () => {},
  };

  const paymentProvider: IPaymentProvider = {
    getOrCreatePlan: async () => ({
      planToken: "plan_tok_new",
      subscribeUrl: "https://checkout.test/plan_tok_new",
      dlocalPlanId: 999,
    }),
    cancelSubscription: async () => {},
    getSubscription: async () => ({
      subscriptionId: 1,
      subscriptionToken: "sub_tok",
      status: "CONFIRMED",
      active: true,
      scheduledDate: null,
      clientEmail: "owner@test.com",
    }),
    getExecution: async () => ({
      executionId: 1,
      orderId: "exec_1",
      status: "COMPLETED",
      currency: "UYU",
      amountPaid: 1390,
    }),
  };

  const useCase = new CreateSubscriptionUseCase(
    subscriptionRepository,
    businessRepository,
    paymentProvider,
  );

  const result = await useCase.execute({
    businessId: "biz_1",
    plan: "pro",
    email: "owner@test.com",
  });

  assert.equal(canceledPendingId, null);
  assert.ok(createdPayload);
  const created = createdPayload as Omit<Subscription, "id" | "created_at">;
  assert.equal(created.plan, "pro");
  assert.equal(result.planToken, "plan_tok_new");
  assert.match(result.subscribeUrl, /external_id=sub_new/);
});

test("subscription controller oculta pending si ya existe una activa", async () => {
  const active = buildSubscription({
    status: "active",
    dlocal_subscription_id: 321,
    dlocal_subscription_token: "sub_tok_active",
    current_period_start: "2026-05-01T00:00:00.000Z",
    current_period_end: "2026-05-31T00:00:00.000Z",
  });
  const pending = buildSubscription({
    id: "sub_pending",
    status: "pending",
  });

  const subscriptionRepository: ISubscriptionRepository = {
    findById: async () => null,
    findByBusinessId: async () => active,
    findActiveByBusinessId: async () => active,
    findCurrentEffectiveByBusinessId: async () => active,
    findPendingByBusinessId: async () => pending,
    findByPlanToken: async () => null,
    findBySubscriptionToken: async () => null,
    findByExecutionId: async () => null,
    findExpiredGracePeriods: async () => [],
    findEndedCanceledSubscriptions: async () => [],
    create: async () => {
      throw new Error("not used");
    },
    updateStatus: async () => active,
  };

  const controller = new SubscriptionController(
    subscriptionRepository,
    {} as IPaymentProvider,
    {} as CreateSubscriptionUseCase,
    {} as any,
    {} as any,
  );

  let payload: any = null;
  const res = {
    json(data: unknown) {
      payload = data;
      return this;
    },
  };

  await controller.get(
    { businessId: "biz_1" } as any,
    res as any,
    (error?: unknown) => {
      if (error) throw error;
    },
  );

  assert.equal(payload.activeSubscription.id, active.id);
  assert.equal(payload.pendingSubscription, null);
  assert.equal(payload.effectivePlan, "pro");
  assert.equal(payload.planSource, "subscription");
});
