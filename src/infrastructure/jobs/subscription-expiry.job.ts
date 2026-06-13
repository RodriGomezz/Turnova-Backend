import { SubscriptionRepository } from "../database/SubscriptionRepository";
import { BusinessRepository } from "../database/BusinessRepository";
import { logger } from "../logger";
import {
  shouldDegradeEndedCanceledSubscription,
  shouldDegradeExpiredGracePeriod,
} from "../../domain/subscription-access";
import { updateBusinessNetwork, findNetworkBusinessIds } from "../database/business-network";
import { dlocalGoClient } from "../payments/dlocalgo.client";
import { HandleWebhookUseCase } from "../../application/subscriptions/HandleWebhookUseCase";
import { EmailService } from "../../application/email/email.service";

const INTERVAL_MS = 60 * 60 * 1000; // cada hora

const subscriptionRepository = new SubscriptionRepository();
const businessRepository      = new BusinessRepository();
const emailService            = new EmailService();
const handleWebhookUseCase    = new HandleWebhookUseCase(
  subscriptionRepository,
  businessRepository,
  emailService,
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function downgradeBusinessToStarter(
  businessId: string,
  subscriptionId: string,
  nextStatus: "expired",
  reason: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();

  await subscriptionRepository.updateStatus(subscriptionId, nextStatus);

  await updateBusinessNetwork(businessId, {
    plan: "starter",
    subscription_downgraded_at: now,
  });

  const businessIds = await findNetworkBusinessIds(businessId);
  const toDeactivate = businessIds.slice(1);
  for (const id of toDeactivate) {
    await businessRepository.update(id, { activo: false });
    logger.info("Sucursal desactivada por degradación a Starter", {
      businessId: id,
      masterBusinessId: businessId,
    });
  }

  logger.info("Plan degradado a Starter por suscripción vencida", {
    businessId,
    subscriptionId,
    ...reason,
  });
}

// ── Reconciliación ────────────────────────────────────────────────────────────

/**
 * Suscripciones active con current_period_end vencido hace más de 1 hora.
 * dLocal cobró pero el webhook no llegó → consultar y activar.
 * Si dLocal no confirma → pasar a past_due.
 */
async function reconcileStaleActiveSubscriptions(): Promise<void> {
  const stale = await subscriptionRepository.findStaleActive();
  if (stale.length === 0) return;

  logger.info(`Reconciliando ${stale.length} suscripción(es) active con período vencido`);

  for (const sub of stale) {
    try {
      if (sub.dlocal_plan_id && sub.payer_email) {
        const remote = await dlocalGoClient.findLatestSubscriptionByPlanAndEmail(
          sub.dlocal_plan_id,
          sub.payer_email,
        );

        if (remote?.status === "CONFIRMED" || remote?.active) {
          await handleWebhookUseCase.execute({
            external_id:        sub.id,
            subscription_id:    remote.subscriptionId ?? sub.dlocal_subscription_id ?? undefined,
            subscription_token: remote.subscriptionToken ?? sub.dlocal_subscription_token ?? undefined,
            client_email:       remote.clientEmail ?? sub.payer_email ?? undefined,
            status:             "CONFIRMED",
          });
          logger.info("Suscripción active reconciliada exitosamente", {
            subscriptionId: sub.id,
            businessId:     sub.business_id,
          });
          continue;
        }
      }

      await subscriptionRepository.updateStatus(sub.id, "past_due");
      logger.warn("Suscripción active con período vencido degradada a past_due", {
        subscriptionId:   sub.id,
        businessId:       sub.business_id,
        currentPeriodEnd: sub.current_period_end,
      });
    } catch (err) {
      logger.error("Error reconciliando suscripción active vencida", {
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

/**
 * Suscripciones en past_due — primer cobro fallido.
 * dLocal puede haber reintentado con éxito sin que el webhook llegara.
 * Si dLocal confirma → activar. Si no → sin cambios (dLocal reintentará).
 */
async function reconcilePastDueSubscriptions(): Promise<void> {
  const pastDueSubs = await subscriptionRepository.findReconcilablePastDue();
  if (pastDueSubs.length === 0) return;

  logger.info(`Reconciliando ${pastDueSubs.length} suscripción(es) en past_due`);

  for (const sub of pastDueSubs) {
    try {
      const remote = await dlocalGoClient.findLatestSubscriptionByPlanAndEmail(
        sub.dlocal_plan_id!,
        sub.payer_email!,
      );

      if (remote?.status === "CONFIRMED" || remote?.active) {
        await handleWebhookUseCase.execute({
          external_id:        sub.id,
          subscription_id:    remote.subscriptionId ?? sub.dlocal_subscription_id ?? undefined,
          subscription_token: remote.subscriptionToken ?? sub.dlocal_subscription_token ?? undefined,
          client_email:       remote.clientEmail ?? sub.payer_email ?? undefined,
          status:             "CONFIRMED",
        });
        logger.info("Suscripción past_due reconciliada — cobro confirmado en dLocal", {
          subscriptionId: sub.id,
          businessId:     sub.business_id,
        });
      } else {
        logger.info("Suscripción past_due sin cobro confirmado en dLocal — sin cambios", {
          subscriptionId: sub.id,
          businessId:     sub.business_id,
          remoteStatus:   remote?.status ?? "not_found",
        });
      }
    } catch (err) {
      logger.error("Error reconciliando suscripción past_due", {
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

/**
 * Suscripciones en grace_period — segundo cobro fallido.
 * Si dLocal confirma cobro exitoso → activar.
 * Si no → dejar que processExpiredGracePeriods la degrade cuando venza.
 */
async function reconcileGracePeriodSubscriptions(): Promise<void> {
  const graceSubs = await subscriptionRepository.findReconcilableGracePeriods();
  if (graceSubs.length === 0) return;

  logger.info(`Reconciliando ${graceSubs.length} suscripción(es) en grace_period`);

  for (const sub of graceSubs) {
    try {
      const remote = await dlocalGoClient.findLatestSubscriptionByPlanAndEmail(
        sub.dlocal_plan_id!,
        sub.payer_email!,
      );

      if (remote?.status === "CONFIRMED" || remote?.active) {
        await handleWebhookUseCase.execute({
          external_id:        sub.id,
          subscription_id:    remote.subscriptionId ?? sub.dlocal_subscription_id ?? undefined,
          subscription_token: remote.subscriptionToken ?? sub.dlocal_subscription_token ?? undefined,
          client_email:       remote.clientEmail ?? sub.payer_email ?? undefined,
          status:             "CONFIRMED",
        });
        logger.info("Suscripción grace_period reconciliada — cobro confirmado en dLocal", {
          subscriptionId: sub.id,
          businessId:     sub.business_id,
        });
      } else {
        logger.info("Suscripción grace_period sin cobro confirmado en dLocal — sin cambios", {
          subscriptionId: sub.id,
          businessId:     sub.business_id,
          remoteStatus:   remote?.status ?? "not_found",
        });
      }
    } catch (err) {
      logger.error("Error reconciliando suscripción grace_period", {
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

// ── Expiración / degradación ──────────────────────────────────────────────────

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
        businessId:     subscription.business_id,
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
        businessId:     subscription.business_id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

// ── Entry points ──────────────────────────────────────────────────────────────

export async function processSubscriptionExpirations(): Promise<void> {
  logger.info("Job de suscripciones: iniciando ciclo", { timestamp: new Date().toISOString() });
  await reconcileStaleActiveSubscriptions();  // active + período vencido
  await reconcilePastDueSubscriptions();      // past_due → dLocal cobró sin webhook
  await reconcileGracePeriodSubscriptions();  // grace_period → dLocal cobró sin webhook
  await processExpiredGracePeriods();         // grace_period vencido → expired
  await processEndedCanceledSubscriptions();  // canceled vencido → expired
  logger.info("Job de suscripciones: ciclo completado", { timestamp: new Date().toISOString() });
}

export function startSubscriptionExpiryJob(): void {
  logger.info(
    `Job de expiración de suscripciones iniciado (cada ${INTERVAL_MS / 1000 / 60} min)`,
  );

  let isRunning = false;

  const run = (): void => {
    if (isRunning) {
      logger.warn("Job de suscripciones ya en ejecución — omitiendo ciclo");
      return;
    }
    isRunning = true;
    processSubscriptionExpirations()
      .catch((err) => logger.error("Error en job de suscripciones", { err }))
      .finally(() => { isRunning = false; });
  };

  run();
  setInterval(run, INTERVAL_MS);
}