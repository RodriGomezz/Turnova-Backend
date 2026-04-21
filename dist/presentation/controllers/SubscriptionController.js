"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const errors_1 = require("../../domain/errors");
class SubscriptionController {
    constructor(subscriptionRepository, paymentProvider, createSubscriptionUseCase, userRepository, businessRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.paymentProvider = paymentProvider;
        this.createSubscriptionUseCase = createSubscriptionUseCase;
        this.userRepository = userRepository;
        this.businessRepository = businessRepository;
        /** GET /api/subscriptions — estado actual de la suscripción */
        this.get = async (req, res, next) => {
            try {
                const activeSubscription = await this.subscriptionRepository.findCurrentEffectiveByBusinessId(req.businessId);
                const pendingSubscription = await this.subscriptionRepository.findPendingByBusinessId(req.businessId);
                res.json({
                    subscription: activeSubscription,
                    activeSubscription,
                    pendingSubscription,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /** POST /api/subscriptions — iniciar checkout */
        this.create = async (req, res, next) => {
            try {
                const { plan, firstName, lastName, email } = req.body;
                const user = await this.userRepository.findById(req.userId);
                if (!user)
                    throw new errors_1.NotFoundError("Usuario");
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                const { checkoutUrl } = await this.createSubscriptionUseCase.execute({
                    businessId: req.businessId,
                    plan,
                    email,
                    firstName,
                    lastName,
                    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:4200",
                });
                res.json({ checkoutUrl });
            }
            catch (error) {
                next(error);
            }
        };
        /** DELETE /api/subscriptions — cancelar suscripción */
        this.cancel = async (req, res, next) => {
            try {
                const subscription = await this.subscriptionRepository.findActiveByBusinessId(req.businessId);
                if (!subscription)
                    throw new errors_1.NotFoundError("Suscripción");
                if (subscription.status === "canceled") {
                    throw new errors_1.AppError("La suscripción ya está cancelada", 400);
                }
                await this.paymentProvider.cancelSubscription(subscription.dlocal_subscription_id);
                await this.subscriptionRepository.updateStatus(subscription.id, "canceled", { canceled_at: new Date().toISOString() });
                // El plan se mantiene hasta que venza current_period_end — el cron lo degrada
                res.json({
                    message: "Suscripción cancelada. Tu plan se mantiene activo hasta el fin del período.",
                    currentPeriodEnd: subscription.current_period_end ?? undefined,
                });
            }
            catch (error) {
                next(error);
            }
        };
        /** GET /api/subscriptions/history — historial de pagos via dLocal */
        this.getHistory = async (req, res, next) => {
            try {
                const subscription = await this.subscriptionRepository.findCurrentEffectiveByBusinessId(req.businessId);
                if (!subscription) {
                    res.json({ payments: [] });
                    return;
                }
                const details = await this.paymentProvider.getSubscription(subscription.dlocal_subscription_id);
                res.json({
                    subscription: {
                        plan: subscription.plan,
                        status: subscription.status,
                        currentPeriodEnd: subscription.current_period_end,
                        gracePeriodEndsAt: subscription.grace_period_ends_at,
                        nextBillingDate: details.nextBillingDate,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.SubscriptionController = SubscriptionController;
//# sourceMappingURL=SubscriptionController.js.map