import dotenv from "dotenv";
dotenv.config();
import { logger } from "./infrastructure/logger";
import { startDomainVerificationJob } from "./infrastructure/jobs/domain-verification.job";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", // anon key eliminada — el backend no la necesita
  "JWT_SECRET",
];

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.error(`Variable de entorno requerida faltante: ${varName}`);
    process.exit(1);
  }
}

import { app } from "./app";

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  logger.info(`Entorno: ${process.env.NODE_ENV}`);
  startDomainVerificationJob();
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
