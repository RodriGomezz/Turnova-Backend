import { SubscriptionRepository } from "../database/SubscriptionRepository";
import { BusinessRepository } from "../database/BusinessRepository";
import { logger } from "../logger";

const INTERVAL_MS = 60 * 60 * 1000; // cada hora

const subscriptionRepository = new SubscriptionRepository();
const businessRepository = new BusinessRepository();

async function processExpiredGracePeriods(): Promise<void> {
  const expired = await subscriptionRepository.findExpiredGracePeriods();

  if (expired.length === 0) return;

  logger.info(`Procesando ${expired.length} suscripción(es) con gracia expirada`);

  for (const subscription of expired) {
    try {
      await businessRepository.update(subscription.business_id, {
        plan: "starter",
      });

      await subscriptionRepository.updateStatus(subscription.id, "expired");

      logger.info("Plan degradado a Starter por gracia expirada", {
        businessId: subscription.business_id,
        subscriptionId: subscription.id,
        gracePeriodEndsAt: subscription.grace_period_ends_at,
      });
    } catch (err) {
      logger.error("Error procesando suscripción expirada", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

export function startSubscriptionExpiryJob(): void {
  logger.info(
    `Job de expiración de suscripciones iniciado (cada ${INTERVAL_MS / 1000 / 60} min)`,
  );

processExpiredGracePeriods().catch((err) =>
  logger.error("Error en primera ejecución del job de suscripciones", {
    err,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }),
);

  setInterval(() => {
    processExpiredGracePeriods().catch((err) =>
      logger.error("Error en job de suscripciones", { err }),
    );
  }, INTERVAL_MS);
}
