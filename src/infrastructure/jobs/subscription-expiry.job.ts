import { SubscriptionRepository } from "../database/SubscriptionRepository";
import { BusinessRepository } from "../database/BusinessRepository";
import { logger } from "../logger";
import {
  shouldDegradeEndedCanceledSubscription,
  shouldDegradeExpiredGracePeriod,
} from "../../domain/subscription-access";

const INTERVAL_MS = 60 * 60 * 1000; // cada hora

const subscriptionRepository = new SubscriptionRepository();
const businessRepository = new BusinessRepository();

async function downgradeBusinessToStarter(
  businessId: string,
  subscriptionId: string,
  nextStatus: "expired",
  reason: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();

  // Primero marcamos la suscripción como expired para que el cron sea idempotente:
  // si el proceso muere entre las dos operaciones, la suscripción ya no volverá
  // a ser procesada en la próxima ejecución.
  await subscriptionRepository.updateStatus(subscriptionId, nextStatus);

  // Luego degradamos el negocio y registramos la fecha de degradación.
  // subscription_downgraded_at permite a getBusinessStatus distinguir un Starter
  // "original" (nunca pagó) de uno degradado (suscripción vencida), bloqueando
  // al segundo para que no pueda seguir operando con plan gratuito.
  await businessRepository.update(businessId, {
    plan: "starter",
    subscription_downgraded_at: now,
  });

  logger.info("Plan degradado a Starter por suscripción vencida", {
    businessId,
    subscriptionId,
    ...reason,
  });
}

async function processExpiredGracePeriods(): Promise<void> {
  const expired = await subscriptionRepository.findExpiredGracePeriods();

  if (expired.length === 0) return;

  logger.info(`Procesando ${expired.length} suscripción(es) con gracia expirada`);

  for (const subscription of expired) {
    if (!shouldDegradeExpiredGracePeriod(subscription)) continue;

    try {
      await downgradeBusinessToStarter(
        subscription.business_id,
        subscription.id,
        "expired",
        { gracePeriodEndsAt: subscription.grace_period_ends_at },
      );
    } catch (err) {
      logger.error("Error procesando suscripción con gracia expirada", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

async function processEndedCanceledSubscriptions(): Promise<void> {
  const ended = await subscriptionRepository.findEndedCanceledSubscriptions();

  if (ended.length === 0) return;

  logger.info(`Procesando ${ended.length} suscripción(es) canceladas ya vencidas`);

  for (const subscription of ended) {
    if (!shouldDegradeEndedCanceledSubscription(subscription)) continue;

    try {
      await downgradeBusinessToStarter(
        subscription.business_id,
        subscription.id,
        "expired",
        { currentPeriodEnd: subscription.current_period_end },
      );
    } catch (err) {
      logger.error("Error procesando suscripción cancelada vencida", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

export async function processSubscriptionExpirations(): Promise<void> {
  await processExpiredGracePeriods();
  await processEndedCanceledSubscriptions();
}

export function startSubscriptionExpiryJob(): void {
  logger.info(
    `Job de expiración de suscripciones iniciado (cada ${INTERVAL_MS / 1000 / 60} min)`,
  );

  processSubscriptionExpirations().catch((err) =>
    logger.error("Error en primera ejecución del job de suscripciones", { err }),
  );

  setInterval(() => {
    processSubscriptionExpirations().catch((err) =>
      logger.error("Error en job de suscripciones", { err }),
    );
  }, INTERVAL_MS);
}
