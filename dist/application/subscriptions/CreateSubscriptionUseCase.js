"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSubscriptionUseCase = void 0;
const errors_1 = require("../../domain/errors");
class CreateSubscriptionUseCase {
    constructor(subscriptionRepository, businessRepository, paymentProvider) {
        this.subscriptionRepository = subscriptionRepository;
        this.businessRepository = businessRepository;
        this.paymentProvider = paymentProvider;
    }
    async execute(input) {
        const business = await this.businessRepository.findById(input.businessId);
        if (!business)
            throw new errors_1.AppError("Negocio no encontrado", 404);
        const latest = await this.subscriptionRepository.findByBusinessId(input.businessId);
        if (latest && (latest.status === "past_due" || latest.status === "grace_period")) {
            throw new errors_1.ConflictError("Tenés un pago pendiente. Esperá que se resuelva antes de cambiar de plan.");
        }
        const pending = await this.subscriptionRepository.findPendingByBusinessId(input.businessId);
        if (pending) {
            await this.subscriptionRepository.updateStatus(pending.id, "canceled", {
                canceled_at: new Date().toISOString(),
            });
        }
        const result = await this.paymentProvider.createSubscription({
            businessId: input.businessId,
            plan: input.plan,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            successUrl: `${input.frontendUrl}/panel/configuracion?tab=planes&success=true`,
            cancelUrl: `${input.frontendUrl}/panel/configuracion?tab=planes&canceled=true`,
        });
        await this.subscriptionRepository.create({
            business_id: input.businessId,
            plan: input.plan,
            status: "pending",
            dlocal_subscription_id: result.subscriptionId,
            dlocal_payment_id: null,
            current_period_start: null,
            current_period_end: null,
            grace_period_ends_at: null,
            canceled_at: null,
        });
        return { checkoutUrl: result.checkoutUrl };
    }
}
exports.CreateSubscriptionUseCase = CreateSubscriptionUseCase;
//# sourceMappingURL=CreateSubscriptionUseCase.js.map