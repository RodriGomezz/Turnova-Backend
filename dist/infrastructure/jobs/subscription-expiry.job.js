"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSubscriptionExpirations = processSubscriptionExpirations;
exports.startSubscriptionExpiryJob = startSubscriptionExpiryJob;
const SubscriptionRepository_1 = require("../database/SubscriptionRepository");
const BusinessRepository_1 = require("../database/BusinessRepository");
const logger_1 = require("../logger");
const subscription_access_1 = require("../../domain/subscription-access");
const INTERVAL_MS = 60 * 60 * 1000; // cada hora
const subscriptionRepository = new SubscriptionRepository_1.SubscriptionRepository();
const businessRepository = new BusinessRepository_1.BusinessRepository();
async function downgradeBusinessToStarter(businessId, subscriptionId, nextStatus, reason) {
    await businessRepository.update(businessId, {
        plan: "starter",
    });
    await subscriptionRepository.updateStatus(subscriptionId, nextStatus);
    logger_1.logger.info("Plan degradado a Starter por suscripción vencida", {
        businessId,
        subscriptionId,
        ...reason,
    });
}
async function processExpiredGracePeriods() {
    const expired = await subscriptionRepository.findExpiredGracePeriods();
    if (expired.length === 0)
        return;
    logger_1.logger.info(`Procesando ${expired.length} suscripción(es) con gracia expirada`);
    for (const subscription of expired) {
        if (!(0, subscription_access_1.shouldDegradeExpiredGracePeriod)(subscription))
            continue;
        try {
            await downgradeBusinessToStarter(subscription.business_id, subscription.id, "expired", { gracePeriodEndsAt: subscription.grace_period_ends_at });
        }
        catch (err) {
            logger_1.logger.error("Error procesando suscripción con gracia expirada", {
                subscriptionId: subscription.id,
                businessId: subscription.business_id,
                error: err instanceof Error ? err.message : err,
            });
        }
    }
}
async function processEndedCanceledSubscriptions() {
    const ended = await subscriptionRepository.findEndedCanceledSubscriptions();
    if (ended.length === 0)
        return;
    logger_1.logger.info(`Procesando ${ended.length} suscripción(es) canceladas ya vencidas`);
    for (const subscription of ended) {
        if (!(0, subscription_access_1.shouldDegradeEndedCanceledSubscription)(subscription))
            continue;
        try {
            await downgradeBusinessToStarter(subscription.business_id, subscription.id, "expired", { currentPeriodEnd: subscription.current_period_end });
        }
        catch (err) {
            logger_1.logger.error("Error procesando suscripción cancelada vencida", {
                subscriptionId: subscription.id,
                businessId: subscription.business_id,
                error: err instanceof Error ? err.message : err,
            });
        }
    }
}
async function processSubscriptionExpirations() {
    await processExpiredGracePeriods();
    await processEndedCanceledSubscriptions();
}
function startSubscriptionExpiryJob() {
    logger_1.logger.info(`Job de expiración de suscripciones iniciado (cada ${INTERVAL_MS / 1000 / 60} min)`);
    processSubscriptionExpirations().catch((err) => logger_1.logger.error("Error en primera ejecución del job de suscripciones", { err }));
    setInterval(() => {
        processSubscriptionExpirations().catch((err) => logger_1.logger.error("Error en job de suscripciones", { err }));
    }, INTERVAL_MS);
}
//# sourceMappingURL=subscription-expiry.job.js.map