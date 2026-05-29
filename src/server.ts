import dotenv from "dotenv";
dotenv.config();
import { logger } from "./infrastructure/logger";
import { startDomainVerificationJob } from "./infrastructure/jobs/domain-verification.job";
import { startSubscriptionExpiryJob } from "./infrastructure/jobs/subscription-expiry.job";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  // JWT_SECRET se mantiene en la lista para que otros servicios que puedan
  // necesitarlo en el futuro no arranquen sin él. La auth actual delega en
  // Supabase, pero la variable documenta la intención de seguridad.
  "JWT_SECRET",
  "DLOCAL_API_KEY",
  "DLOCAL_SECRET_KEY",
  "FRONTEND_URL",
  "API_URL",
];

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.error(`Variable de entorno requerida faltante: ${varName}`);
    process.exit(1);
  }
}

logger.info("Configuración al arrancar", {
  NODE_ENV:            process.env.NODE_ENV,
  FRONTEND_URL:        process.env.FRONTEND_URL,
  API_URL:             process.env.API_URL,
  SANDBOX:             process.env.DLOCAL_SANDBOX,
  LOG_LEVEL:           process.env.LOG_LEVEL ?? "default",
  RATE_LIMIT_DISABLED: process.env.DISABLE_RATE_LIMIT === "true",
});

import { app } from "./app";
import { dlocalGoClient } from "./infrastructure/payments/dlocalgo.client";
import { SubscriptionPlan, BillingCycle } from "./domain/entities/Subscription";

// ── Seguridad de dependencias ─────────────────────────────────────────────────
// Agregar en el pipeline de CI como step bloqueante antes del deploy:
//   npm audit --audit-level=high
// o con Snyk: npx snyk test --severity-threshold=high
// Esto previene que vulnerabilidades en dependencias lleguen a producción sin aviso.
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000;

const PLANS: SubscriptionPlan[] = ["starter", "pro", "business"];
const CYCLES: BillingCycle[]    = ["monthly", "annual"];

const server = app.listen(PORT, async () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  startDomainVerificationJob();
  startSubscriptionExpiryJob();

  // Sincronizar URLs de todos los planes al arrancar (mensual + anual) en paralelo.
  // Promise.allSettled en lugar de Promise.all: si un plan falla, el resto continúa.
  // Secuencial con await en loop tomaba ~3s; en paralelo baja a ~500ms.
  try {
    const apiBase      = process.env.API_URL!;
    const frontendBase = process.env.FRONTEND_URL!;
    const notifUrl     = `${apiBase}/api/subscriptions/dlocal`;
    const successUrl   = `${frontendBase}/panel/configuracion?status=success&tab=planes`;
    const backUrl      = `${frontendBase}/panel/configuracion?status=canceled&tab=planes`;
    const errorUrl     = `${frontendBase}/panel/configuracion?status=error&tab=planes`;

    const tasks = PLANS.flatMap((plan) =>
      CYCLES.map((cycle) =>
        dlocalGoClient.getOrCreatePlan(plan, notifUrl, successUrl, backUrl, errorUrl, cycle),
      ),
    );

    const results = await Promise.allSettled(tasks);

    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length > 0) {
      logger.warn("Algunos planes dLocal Go no pudieron sincronizarse al arrancar", {
        total: tasks.length,
        fallidos: failed.length,
        razones: failed.map((r) => r.reason?.message ?? String(r.reason)),
      });
    } else {
      logger.info("URLs de planes dLocal Go sincronizadas al arrancar (mensual + anual)");
    }
  } catch (err) {
    logger.warn("Error inesperado al sincronizar planes dLocal Go al arrancar", { err });
  }
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("UnhandledRejection", { reason });
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (error: Error) => {
  logger.error("UncaughtException", {
    message: error.message,
    stack: error.stack,
  });
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM recibido — cerrando servidor...");
  server.close(() => {
    logger.info("Servidor cerrado correctamente");
    process.exit(0);
  });
});