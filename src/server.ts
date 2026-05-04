import dotenv from "dotenv";
dotenv.config();
import { logger } from "./infrastructure/logger";
import { startDomainVerificationJob } from "./infrastructure/jobs/domain-verification.job";
import { startSubscriptionExpiryJob } from "./infrastructure/jobs/subscription-expiry.job";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
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
  NODE_ENV:     process.env.NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL,
  API_URL:      process.env.API_URL,
  SANDBOX:      process.env.DLOCAL_SANDBOX,
  LOG_LEVEL:    process.env.LOG_LEVEL ?? "default",
});

import { app } from "./app";
import { dlocalGoClient } from "./infrastructure/payments/dlocalgo.client";
import { PLAN_PRICES, PLAN_NAMES } from "./domain/plan-prices";
import { SubscriptionPlan } from "./domain/entities/Subscription";

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, async () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  startDomainVerificationJob();
  startSubscriptionExpiryJob();

  // Al arrancar, parchear las URLs de todos los planes existentes en dLocal Go.
  // Esto corrige el caso donde los planes fueron creados con FRONTEND_URL incorrecto
  // (ej: localhost) y ahora dLocal Go redirige al lugar equivocado tras el pago.
  try {
    const apiBase      = process.env.API_URL!;
    const frontendBase = process.env.FRONTEND_URL!;
    const notifUrl     = `${apiBase}/api/subscriptions/dlocal`;
    const successUrl   = `${frontendBase}/panel/configuracion?status=success&tab=planes`;
    const backUrl      = `${frontendBase}/panel/configuracion?status=canceled&tab=planes`;
    const errorUrl     = `${frontendBase}/panel/configuracion?status=error&tab=planes`;

    for (const plan of Object.keys(PLAN_PRICES) as SubscriptionPlan[]) {
      await dlocalGoClient.getOrCreatePlan(
        plan,
        notifUrl,
        successUrl,
        backUrl,
        errorUrl,
      );
    }
    logger.info("URLs de planes dLocal Go sincronizadas al arrancar");
  } catch (err) {
    logger.warn("No se pudieron sincronizar URLs de planes dLocal Go al arrancar", { err });
  }
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("UnhandledRejection", { reason });
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (error: Error) => {
  logger.error("UncaughtException", { message: (error as Error).message, stack: (error as Error).stack });
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM recibido — cerrando servidor...");
  server.close(() => {
    logger.info("Servidor cerrado correctamente");
    process.exit(0);
  });
});