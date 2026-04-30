import { Request, Response, NextFunction } from "express";
import {
  HandleWebhookUseCase,
  DLocalGoWebhookPayload,
} from "../../application/subscriptions/HandleWebhookUseCase";
import { AppError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";
import crypto from "crypto";

/**
 * POST /api/subscriptions/dlocal
 *
 * dLocal Go envía una notificación al notification_url del plan cada vez que:
 *  - Un usuario completa el checkout (status: CONFIRMED)
 *  - Se ejecuta un cobro recurrente (execution_status: COMPLETED | DECLINED)
 *  - Se cancela una suscripción (status: CANCELLED)
 *
 * Autenticación: dLocal Go firma el payload con HMAC-SHA256 usando el Secret Key
 * en el header X-Signature (verificar si está disponible en tu plan).
 */
export class WebhookController {
  constructor(private readonly handleWebhookUseCase: HandleWebhookUseCase) {}

  handleDLocal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Verificar firma si el secret está configurado
      const signature = req.headers["x-signature"] as string | undefined;
      if (signature) {
        this.verifySignature(req.body as Buffer, signature);
      } else {
        logger.warn("Webhook dLocal Go recibido sin X-Signature — omitiendo verificación");
      }

      const rawBody = (req.body as Buffer).toString();
      let payload: DLocalGoWebhookPayload;

      try {
        payload = JSON.parse(rawBody) as DLocalGoWebhookPayload;
      } catch {
        throw new AppError("Payload de webhook inválido", 400);
      }

      // Validación mínima: necesitamos al menos algún identificador
      const hasIdentifier =
        payload.subscription_token ||
        payload.plan_token ||
        payload.order_id ||
        payload.id;

      if (!hasIdentifier) {
        logger.warn("Webhook sin identificadores reconocibles", { payload });
        // Respondemos 200 igual para que dLocal Go no reintente indefinidamente
        res.status(200).json({ received: true });
        return;
      }

      // Responder 200 de inmediato — dLocal Go reintenta si no recibe respuesta rápida
      res.status(200).json({ received: true });

      // Procesar de forma asíncrona
      this.handleWebhookUseCase.execute(payload).catch((err) =>
        logger.error("Error procesando webhook dLocal Go", {
          subscriptionToken: payload.subscription_token,
          orderId: payload.order_id,
          err,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  private verifySignature(rawBody: Buffer, signature: string): void {
    const secret = process.env.DLOCAL_SECRET_KEY;
    if (!secret) {
      logger.warn("DLOCAL_SECRET_KEY no configurado — verificación omitida");
      return;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature.length !== expected.length) {
      logger.warn("Firma de webhook inválida (longitud)");
      throw new AppError("Firma de webhook inválida", 401);
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );

    if (!valid) {
      logger.warn("Firma de webhook inválida");
      throw new AppError("Firma de webhook inválida", 401);
    }
  }
}
