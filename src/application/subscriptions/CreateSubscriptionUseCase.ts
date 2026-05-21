import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { SubscriptionPlan, BillingCycle } from "../../domain/entities/Subscription";
import { AppError, ConflictError } from "../../domain/errors";
import { getPlanPrice, getPlanName, TRIAL_DAYS } from "../../domain/plan-prices";

export interface CreateSubscriptionInput {
  businessId: string;
  plan: SubscriptionPlan;
  email: string;
  /** Ciclo de facturación. Por defecto "monthly" para compatibilidad. */
  billingCycle?: BillingCycle;
}

export interface CreateSubscriptionOutput {
  /** URL del checkout hosted de dLocal Go — redirigir al usuario aquí */
  subscribeUrl: string;
  /** plan_token de dLocal Go */
  planToken: string;
  /** ID interno de la suscripción (también enviado como external_id a dLocal Go) */
  subscriptionId: string;
  /** Días de prueba que aplican a este checkout */
  trialDays: number;
}

export class CreateSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly paymentProvider: IPaymentProvider,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput> {
    const cycle: BillingCycle = input.billingCycle ?? "monthly";

    const business = await this.businessRepository.findById(input.businessId);
    if (!business) throw new AppError("Negocio no encontrado", 404);

    // Bloquear si ya tiene suscripción activa o en gracia
    const latest = await this.subscriptionRepository.findByBusinessId(input.businessId);
    if (latest && latest.status === "active") {
      throw new ConflictError(
        "Ya tenés una suscripción activa. Cancelala antes de cambiar de plan.",
      );
    }
    if (latest && (latest.status === "past_due" || latest.status === "grace_period")) {
      throw new ConflictError(
        "Tenés un pago pendiente. Esperá a que se resuelva antes de cambiar de plan.",
      );
    }

    // Cancelar cualquier checkout pendiente previo
    const pending = await this.subscriptionRepository.findPendingByBusinessId(
      input.businessId,
    );
    if (pending) {
      await this.subscriptionRepository.updateStatus(pending.id, "canceled", {
        canceled_at: new Date().toISOString(),
      });
    }

    const apiBase      = process.env.API_URL ?? "http://localhost:3000";
    const frontendBase = process.env.FRONTEND_URL ?? "http://localhost:5173";

    const notificationUrl = `${apiBase}/api/subscriptions/dlocal`;
    const successUrl = `${frontendBase}/panel/configuracion?status=success&tab=planes`;
    const backUrl    = `${frontendBase}/panel/configuracion?status=canceled&tab=planes`;
    const errorUrl   = `${frontendBase}/panel/configuracion?status=error&tab=planes`;

    // Obtener o crear el plan en dLocal Go (distinguido por cycle)
    const checkoutResult = await this.paymentProvider.getOrCreatePlan(
      input.plan,
      notificationUrl,
      successUrl,
      backUrl,
      errorUrl,
      cycle,
    );

    // Determinar días de prueba:
    // Solo aplicar si el negocio nunca tuvo suscripción paga (no degradado)
    const trialDays =
      !business.subscription_downgraded_at && !latest
        ? TRIAL_DAYS
        : 0;

    const newSubscription = await this.subscriptionRepository.create({
      business_id: input.businessId,
      plan: input.plan,
      status: "pending",
      billing_cycle: cycle,
      dlocal_plan_id: checkoutResult.dlocalPlanId,
      dlocal_plan_token: checkoutResult.planToken,
      dlocal_subscription_id: null,
      dlocal_subscription_token: null,
      dlocal_last_execution_id: null,
      payer_email: input.email,
      current_period_start: null,
      current_period_end: null,
      grace_period_ends_at: null,
      canceled_at: null,
    });

    const baseUrl = checkoutResult.subscribeUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";
    const checkoutParams = new URLSearchParams();
    if (input.email) checkoutParams.set("email", input.email);
    checkoutParams.set("external_id", newSubscription.id);

    const subscribeUrl = `${baseUrl}${separator}${checkoutParams.toString()}`;

    return {
      subscribeUrl,
      planToken: checkoutResult.planToken,
      subscriptionId: newSubscription.id,
      trialDays,
    };
  }
}
