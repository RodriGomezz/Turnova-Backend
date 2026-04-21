"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandleWebhookUseCase = void 0;
const logger_1 = require("../../infrastructure/logger");
const GRACE_PERIOD_DAYS = 7;
class HandleWebhookUseCase {
    constructor(subscriptionRepository, businessRepository, emailService) {
        this.subscriptionRepository = subscriptionRepository;
        this.businessRepository = businessRepository;
        this.emailService = emailService;
    }
    async execute(payload) {
        const paymentId = this.getPaymentId(payload);
        const orderId = this.getOrderId(payload);
        const status = this.normalizeStatus(payload.status);
        logger_1.logger.info("Webhook dLocal Go recibido", {
            paymentId,
            orderId,
            rawStatus: payload.status,
            status,
        });
        switch (status) {
            case "PAID":
                await this.handlePaymentPaid(payload);
                break;
            case "PENDING":
                logger_1.logger.info("Pago dLocal todavía pendiente", { paymentId, orderId });
                break;
            case "REJECTED":
            case "EXPIRED":
                await this.handlePaymentFailed(payload);
                break;
            case "CANCELLED":
                await this.handlePaymentCancelled(payload);
                break;
            case "REFUNDED":
                await this.handlePaymentRefunded(payload);
                break;
            default: logger_1.logger.warn("Evento dLocal Go no manejado", { status });
        }
    }
    async handlePaymentPaid(payload) {
        const subscription = await this.findSubscription(payload);
        if (!subscription)
            return;
        const paymentId = this.getPaymentId(payload);
        const previousActive = await this.subscriptionRepository.findActiveByBusinessId(subscription.business_id);
        const now = new Date();
        const nextPeriodEnd = new Date(now);
        nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);
        await this.subscriptionRepository.updateStatus(subscription.id, "active", {
            dlocal_subscription_id: paymentId,
            dlocal_payment_id: paymentId,
            current_period_start: now.toISOString(),
            current_period_end: nextPeriodEnd.toISOString(),
            grace_period_ends_at: null,
        });
        if (previousActive && previousActive.id !== subscription.id) {
            await this.subscriptionRepository.updateStatus(previousActive.id, "canceled", {
                canceled_at: now.toISOString(),
            });
        }
        const business = await this.businessRepository.findById(subscription.business_id);
        if (business &&
            (business.plan !== subscription.plan || business.trial_ends_at !== null)) {
            await this.businessRepository.update(subscription.business_id, {
                plan: subscription.plan,
                trial_ends_at: null,
            });
        }
        this.fireAndForget(() => this.emailService.sendPaymentConfirmation({
            to: business?.email ?? "",
            negocioNombre: business?.nombre ?? "",
            plan: subscription.plan,
            amount: PLAN_PRICES_MAP[subscription.plan] ?? 0,
            currency: "UYU",
            nextBillingDate: nextPeriodEnd.toISOString(),
        }));
    }
    async handlePaymentFailed(payload) {
        const subscription = await this.findSubscription(payload);
        if (!subscription)
            return;
        const paymentId = this.getPaymentId(payload);
        if (subscription.status === "pending") {
            await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
                dlocal_payment_id: paymentId,
                canceled_at: new Date().toISOString(),
            });
            return;
        }
        if (subscription.status === "grace_period")
            return;
        const newStatus = subscription.status === "past_due" ? "grace_period" : "past_due";
        const gracePeriodEndsAt = newStatus === "grace_period"
            ? this.calcGracePeriodEnd(subscription.current_period_end ?? new Date().toISOString())
            : null;
        await this.subscriptionRepository.updateStatus(subscription.id, newStatus, {
            dlocal_payment_id: paymentId,
            grace_period_ends_at: gracePeriodEndsAt,
        });
        const business = await this.businessRepository.findById(subscription.business_id);
        if (newStatus === "grace_period") {
            this.fireAndForget(() => this.emailService.sendPaymentFailedGrace({
                to: business?.email ?? "",
                negocioNombre: business?.nombre ?? "",
                plan: subscription.plan,
                gracePeriodEndsAt: gracePeriodEndsAt ?? "",
            }));
        }
        else {
            this.fireAndForget(() => this.emailService.sendPaymentFailed({
                to: business?.email ?? "",
                negocioNombre: business?.nombre ?? "",
                plan: subscription.plan,
            }));
        }
    }
    async handlePaymentCancelled(payload) {
        const subscription = await this.findSubscription(payload);
        if (!subscription)
            return;
        await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
            canceled_at: new Date().toISOString(),
        });
    }
    async handlePaymentRefunded(payload) {
        const subscription = await this.findSubscription(payload);
        if (!subscription)
            return;
        if (subscription.status === "pending") {
            await this.subscriptionRepository.updateStatus(subscription.id, "canceled", {
                canceled_at: new Date().toISOString(),
            });
            return;
        }
        const gracePeriodEndsAt = this.calcGracePeriodEnd(new Date().toISOString());
        await this.subscriptionRepository.updateStatus(subscription.id, "grace_period", {
            grace_period_ends_at: gracePeriodEndsAt,
        });
        const business = await this.businessRepository.findById(subscription.business_id);
        this.fireAndForget(() => this.emailService.sendPaymentFailedGrace({
            to: business?.email ?? "",
            negocioNombre: business?.nombre ?? "",
            plan: subscription.plan,
            gracePeriodEndsAt,
        }));
    }
    // ── Búsqueda de suscripción ───────────────────────────────────────────────
    async findSubscription(payload) {
        const orderId = this.getOrderId(payload);
        const paymentId = this.getPaymentId(payload);
        // 1. order_id provisional guardado al crear el checkout
        let sub = orderId
            ? await this.subscriptionRepository.findByDlocalId(orderId)
            : null;
        if (sub)
            return sub;
        // 2. Por payment_id ya conciliado previamente
        sub = await this.subscriptionRepository.findByPaymentId(paymentId);
        if (sub)
            return sub;
        // 3. Por businessId embebido en order_id (formato uuid_timestamp)
        if (orderId) {
            const businessId = orderId.split("_")[0];
            if (businessId) {
                sub = await this.subscriptionRepository.findPendingByBusinessId(businessId);
                if (sub)
                    return sub;
            }
        }
        // 4. Fallback: dLocal Go no siempre envía order_id en el primer webhook.
        //    Buscar la suscripción más reciente cuyo dlocal_subscription_id
        //    todavía es el order_id provisional (no empieza con "DP-")
        const recent = await this.subscriptionRepository.findMostRecentPending();
        if (recent) {
            logger_1.logger.info("Suscripción encontrada por fallback", {
                subscriptionId: recent.id,
                paymentId,
            });
            return recent;
        }
        logger_1.logger.warn("Suscripción no encontrada para webhook", {
            paymentId,
            orderId,
        });
        return null;
    }
    getPaymentId(payload) {
        return payload.payment_id ?? payload.id ?? "";
    }
    getOrderId(payload) {
        return payload.order_id;
    }
    normalizeStatus(status) {
        switch ((status ?? "PAID").toUpperCase()) {
            case "APPROVED":
            case "PAID":
            case "AUTHORIZED":
            case "VERIFIED":
                return "PAID";
            case "PENDING":
            case "IN_PROGRESS":
                return "PENDING";
            case "REJECTED":
            case "FAILED":
            case "DECLINED":
                return "REJECTED";
            case "CANCELLED":
            case "CANCELED":
                return "CANCELLED";
            case "EXPIRED":
                return "EXPIRED";
            case "REFUNDED":
                return "REFUNDED";
            default:
                return (status ?? "PAID").toUpperCase();
        }
    }
    calcGracePeriodEnd(fromDate) {
        const d = new Date(fromDate);
        d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
        return d.toISOString();
    }
    fireAndForget(fn) {
        fn().catch((err) => logger_1.logger.error("Error enviando email de suscripción", { err }));
    }
}
exports.HandleWebhookUseCase = HandleWebhookUseCase;
const PLAN_PRICES_MAP = {
    starter: 590,
    pro: 1390,
    business: 2290,
};
//# sourceMappingURL=HandleWebhookUseCase.js.map