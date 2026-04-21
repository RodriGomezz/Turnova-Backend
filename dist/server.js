"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const logger_1 = require("./infrastructure/logger");
const domain_verification_job_1 = require("./infrastructure/jobs/domain-verification.job");
const subscription_expiry_job_1 = require("./infrastructure/jobs/subscription-expiry.job");
const REQUIRED_ENV_VARS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET",
];
for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
        logger_1.logger.error(`Variable de entorno requerida faltante: ${varName}`);
        process.exit(1);
    }
}
const app_1 = require("./app");
const PORT = process.env.PORT ?? 3000;
const server = app_1.app.listen(PORT, () => {
    logger_1.logger.info(`Servidor corriendo en http://localhost:${PORT}`);
    logger_1.logger.info(`Entorno: ${process.env.NODE_ENV}`);
    (0, domain_verification_job_1.startDomainVerificationJob)();
    (0, subscription_expiry_job_1.startSubscriptionExpiryJob)();
});
process.on("unhandledRejection", (reason) => {
    logger_1.logger.error("UnhandledRejection", { reason });
    server.close(() => process.exit(1));
});
process.on("uncaughtException", (error) => {
    logger_1.logger.error("UncaughtException", {
        message: error.message,
        stack: error.stack,
    });
    server.close(() => process.exit(1));
});
process.on("SIGTERM", () => {
    logger_1.logger.info("SIGTERM recibido — cerrando servidor...");
    server.close(() => {
        logger_1.logger.info("Servidor cerrado correctamente");
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map