import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { SubscriptionPlan } from "../../domain/entities/Subscription";
import { AppError, ConflictError } from "../../domain/errors";

export interface CreateSubscriptionInput {
  businessId: string;
  plan: SubscriptionPlan;
  email: string;
  firstName: string;
  lastName: string;
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

    const latest = await this.subscriptionRepository.findByBusinessId(input.businessId);
    if (latest && (latest.status === "past_due" || latest.status === "grace_period")) {
      throw new ConflictError("Tenés un pago pendiente. Esperá que se resuelva antes de cambiar de plan.");
    }

    const pending = await this.subscriptionRepository.findPendingByBusinessId(
      input.businessId,
    );
    if (pending) {
      await this.subscriptionRepository.updateStatus(pending.id, "canceled", {
        canceled_at: new Date().toISOString(),
      });
    }

    const result = await this.paymentProvider.createSubscription({
      businessId: input.businessId,
      plan:       input.plan,
      email:      input.email,
      firstName:  input.firstName,
      lastName:   input.lastName,
      successUrl: `${input.frontendUrl}/panel/configuracion?tab=planes&success=true`,
      cancelUrl:  `${input.frontendUrl}/panel/configuracion?tab=planes&canceled=true`,
    });

    await this.subscriptionRepository.create({
      business_id:            input.businessId,
      plan:                   input.plan,
      status:                 "pending",
      dlocal_subscription_id: result.subscriptionId,
      dlocal_payment_id:      null,
      current_period_start:   null,
      current_period_end:     null,
      grace_period_ends_at:   null,
      canceled_at:            null,
    });

    return { checkoutUrl: result.checkoutUrl };
  }
}
