/**
 * Con dLocal Go, los cobros recurrentes son gestionados automáticamente
 * por la plataforma. dLocal Go cobra al suscriptor según la frecuencia del
 * plan y notifica al backend vía webhook (execution_status: COMPLETED | DECLINED).
 *
 * Este job solo se encarga de detectar suscripciones en grace_period cuyo
 * período de gracia venció sin que dLocal Go reportara un cobro exitoso,
 * y de degradar el plan del negocio correspondiente.
 *
 * NO es necesario disparar cobros manualmente — dLocal Go lo hace.
 */

import { logger } from "../logger";
import { processSubscriptionExpirations } from "./subscription-expiry.job";

const INTERVAL_MS = 60 * 60 * 1000; // cada hora

export function startSubscriptionRenewalJob(): void {
  logger.info(
    "Job de vencimiento de suscripciones iniciado (cada hora). " +
    "Los cobros recurrentes son gestionados por dLocal Go.",
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
