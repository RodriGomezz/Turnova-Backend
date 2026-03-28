import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { Subscription, SubscriptionPlan } from "../../domain/entities/Subscription";
import { AppError, ConflictError } from "../../domain/errors";

export interface CreateSubscriptionInput {
  businessId: string;
  plan: SubscriptionPlan;
  email: string;
  nombre: string;
  /** URL base del frontend — ej: https://app.turnio.pro */
  frontendUrl: string;
}

export class CreateSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly paymentProvider: IPaymentProvider,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<{ checkoutUrl: string }> {
    const business = await this.businessRepository.findById(input.businessId);
    if (!business) throw new AppError("Negocio no encontrado", 404);

    // Evitar suscripciones duplicadas activas
    const existing = await this.subscriptionRepository.findByBusinessId(
      input.businessId,
    );
    if (existing && (existing.status === "active" || existing.status === "past_due")) {
      throw new ConflictError("Ya existe una suscripción activa para este negocio");
    }

    const result = await this.paymentProvider.createSubscription({
      businessId: input.businessId,
      plan: input.plan,
      email: input.email,
      nombre: input.nombre,
      successUrl: `${input.frontendUrl}/panel/billing?success=true`,
      cancelUrl: `${input.frontendUrl}/panel/plans?canceled=true`,
    });

    const now = new Date();
    const periodEnd = new Date(result.nextBillingDate);

    await this.subscriptionRepository.create({
      business_id: input.businessId,
      plan: input.plan,
      status: "active",
      dlocal_subscription_id: result.subscriptionId,
      dlocal_payment_id: null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      grace_period_ends_at: null,
      canceled_at: null,
    });

    // Actualizar plan del negocio inmediatamente
    await this.businessRepository.update(input.businessId, {
      plan: input.plan,
    });

    return { checkoutUrl: result.checkoutUrl };
  }
}
