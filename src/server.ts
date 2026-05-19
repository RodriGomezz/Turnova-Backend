import dotenv from "dotenv";
dotenv.config();
import { logger } from "./infrastructure/logger";
import { startDomainVerificationJob } from "./infrastructure/jobs/domain-verification.job";
import { startSubscriptionExpiryJob } from "./infrastructure/jobs/subscription-expiry.job";

// ── Variables de entorno requeridas ───────────────────────────────────────────
const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "JWT_SECRET",
  // MercadoPago — ACTIVO
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",      // Secret de firma configurado en el Dashboard de MP
  // Infraestructura
  "FRONTEND_URL",
  "API_URL",
];

// Variables de dLocal — DESACTIVADAS (no se validan al arrancar)
// Descomentar si se reactiva dLocal:
// "DLOCAL_API_KEY", "DLOCAL_SECRET_KEY"

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.error(`Variable de entorno requerida faltante: ${varName}`);
    process.exit(1);
  }
}

logger.info("Configuración al arrancar", {
  NODE_ENV:          process.env.NODE_ENV,
  FRONTEND_URL:      process.env.FRONTEND_URL,
  API_URL:           process.env.API_URL,
  MP_SANDBOX:        process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ? "sandbox" : "producción",
  LOG_LEVEL:         process.env.LOG_LEVEL ?? "default",
  PAYMENT_PROVIDER:  "mercadopago",
});

import { app } from "./app";

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  startDomainVerificationJob();
  startSubscriptionExpiryJob();

  logger.info(
    "MercadoPago activo. Configurar webhook en:\n" +
    "  https://www.mercadopago.com/developers/panel → Tus integraciones → Webhooks\n" +
    `  URL: ${process.env.API_URL}/api/subscriptions/mercadopago\n` +
    "  Tópicos: subscription_preapproval_plan, subscription_preapproval, payments",
  );
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("UnhandledRejection", { reason });
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (error: Error) => {
  logger.error("UncaughtException", {
    message: (error as Error).message,
    stack:   (error as Error).stack,
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