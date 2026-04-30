import dotenv from "dotenv";
dotenv.config();
import { logger } from "./infrastructure/logger";
import { startDomainVerificationJob } from "./infrastructure/jobs/domain-verification.job";
import { startSubscriptionExpiryJob } from "./infrastructure/jobs/subscription-expiry.job";
import { startSubscriptionRenewalJob } from "./infrastructure/jobs/subscription-renewal.job";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "JWT_SECRET",
  "DLOCAL_API_KEY",
  "DLOCAL_SECRET_KEY",
];

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.error(`Variable de entorno requerida faltante: ${varName}`);
    process.exit(1);
  }
}

// Log de arranque con estado de variables dLocal Go
logger.info("dLocal Go config", {
  sandbox:   process.env.DLOCAL_SANDBOX ?? "false (producción)",
  apiKeySet: !!process.env.DLOCAL_API_KEY,
  secretSet: !!process.env.DLOCAL_SECRET_KEY,
});

import { app } from "./app";

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  logger.info(`Entorno: ${process.env.NODE_ENV}`);
  startDomainVerificationJob();
  startSubscriptionExpiryJob();
  startSubscriptionRenewalJob();
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