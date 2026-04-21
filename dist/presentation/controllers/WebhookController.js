"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const errors_1 = require("../../domain/errors");
const logger_1 = require("../../infrastructure/logger");
const crypto_1 = __importDefault(require("crypto"));
class WebhookController {
    constructor(handleWebhookUseCase) {
        this.handleWebhookUseCase = handleWebhookUseCase;
        /**
         * POST /api/subscriptions/dlocal
         *
         * dLocal envía el objeto pago completo. También toleramos el formato reducido
         * { payment_id, order_id, status } para compatibilidad.
         *
         * La firma usa HMAC-SHA256 sobre el body raw con el API Secret como clave.
         * Header: X-Signature
         */
        this.handleDLocal = async (req, res, next) => {
            try {
                // Verificar firma si el secret está configurado
                const signature = req.headers["x-signature"];
                if (signature) {
                    this.verifySignature(req.body, signature);
                }
                else {
                    logger_1.logger.warn("Webhook recibido sin X-Signature — omitiendo verificación");
                }
                const rawBody = req.body.toString();
                let payload;
                try {
                    payload = JSON.parse(rawBody);
                }
                catch {
                    throw new errors_1.AppError("Payload de webhook inválido", 400);
                }
                if (!payload.payment_id && !payload.id) {
                    throw new errors_1.AppError("Webhook sin id de pago", 400);
                }
                // Responder 200 de inmediato — dLocal reintenta si no recibe respuesta rápida
                res.status(200).json({ received: true });
                // Procesar de forma asíncrona sin bloquear la respuesta
                this.handleWebhookUseCase.execute(payload).catch((err) => logger_1.logger.error("Error procesando webhook dLocal Go", {
                    paymentId: payload.payment_id ?? payload.id,
                    err,
                }));
            }
            catch (error) {
                next(error);
            }
        };
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    verifySignature(rawBody, signature) {
        const secret = process.env.DLOCAL_WEBHOOK_SECRET;
        if (!secret) {
            logger_1.logger.warn("DLOCAL_WEBHOOK_SECRET no configurado — verificación omitida");
            return;
        }
        const expected = crypto_1.default
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");
        if (signature.length !== expected.length) {
            logger_1.logger.warn("Firma de webhook inválida (longitud)");
            throw new errors_1.AppError("Firma de webhook inválida", 401);
        }
        const valid = crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!valid) {
            logger_1.logger.warn("Firma de webhook inválida");
            throw new errors_1.AppError("Firma de webhook inválida", 401);
        }
    }
}
exports.WebhookController = WebhookController;
//# sourceMappingURL=WebhookController.js.map