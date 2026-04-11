import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { SubscriptionPlan } from "../../domain/entities/Subscription";
import { AppError, ConflictError } from "../../domain/errors";

export interface CreateSubscriptionInput {
  businessId: string;
  plan: SubscriptionPlan;
  email: string;
  nombre: string;
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

    const existing = await this.subscriptionRepository.findByBusinessId(input.businessId);
    if (existing && existing.status === "active") {
      await this.subscriptionRepository.updateStatus(existing.id, "canceled", {
        canceled_at: new Date().toISOString(),
      });
    } else if (existing && existing.status === "past_due") {
      throw new ConflictError("Tenés un pago pendiente. Esperá que se resuelva antes de cambiar de plan.");
    }

    const result = await this.paymentProvider.createSubscription({
      businessId: input.businessId,
      plan:       input.plan,
      email:      input.email,
      nombre:     input.nombre,
      successUrl: `${input.frontendUrl}/panel/configuracion?tab=planes&success=true`,
      cancelUrl:  `${input.frontendUrl}/panel/configuracion?tab=planes&canceled=true`,
    });

    const now       = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    // Guardar suscripción con status "active" pero SIN actualizar el plan del negocio.
    // El plan se actualiza cuando llega el webhook de pago confirmado.
    await this.subscriptionRepository.create({
      business_id:            input.businessId,
      plan:                   input.plan,
      status:                 "active",
      dlocal_subscription_id: result.subscriptionId,
      dlocal_payment_id:      null,
      current_period_start:   now.toISOString(),
      current_period_end:     periodEnd.toISOString(),
      grace_period_ends_at:   null,
      canceled_at:            null,
    });

    // ⚠️  NO actualizar business.plan aquí — se actualiza en HandleWebhookUseCase
    // cuando dLocal confirma el pago via webhook. Así evitamos cambiar el plan
    // si el usuario abandona el checkout sin pagar.

    return { checkoutUrl: result.checkoutUrl };
  }
}
