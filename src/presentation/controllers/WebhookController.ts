import { Request, Response, NextFunction } from "express";
import { HandleWebhookUseCase, DLocalWebhookPayload } from "../../application/subscriptions/HandleWebhookUseCase";
import { AppError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";
import crypto from "crypto";

export class WebhookController {
  constructor(
    private readonly handleWebhookUseCase: HandleWebhookUseCase,
  ) {}

  /**
   * POST /api/webhooks/dlocal
   *
   * dLocal firma cada webhook con HMAC-SHA256 usando el API secret.
   * Verificamos la firma antes de procesar para evitar eventos falsos.
   */
  handleDLocal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // ── Verificar firma ───────────────────────────────────────────────────
      const signature = req.headers["x-signature"] as string | undefined;
      const timestamp  = req.headers["x-timestamp"] as string | undefined;

      if (!signature || !timestamp) {
        throw new AppError("Firma de webhook faltante", 401);
      }

      this.verifySignature(req.body as Buffer, signature, timestamp);

      // ── Parsear payload ───────────────────────────────────────────────────
      const payload = JSON.parse((req.body as Buffer).toString()) as DLocalWebhookPayload;

      // Responder 200 inmediatamente — dLocal reintenta si no recibe respuesta rápida
      res.status(200).json({ received: true });

      // Procesar de forma asíncrona sin bloquear la respuesta
      this.handleWebhookUseCase.execute(payload).catch((err) =>
        logger.error("Error procesando webhook dLocal", {
          eventId: payload.id,
          type: payload.type,
          err,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  // ── Helpers privados ──────────────────────────────────────────────────────

  private verifySignature(
    rawBody: Buffer,
    signature: string,
    timestamp: string,
  ): void {
    const secret = process.env.DLOCAL_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn("DLOCAL_WEBHOOK_SECRET no configurado — verificación omitida");
      return;
    }

    // dLocal firma: HMAC-SHA256(timestamp + "." + rawBody)
    const payload = `${timestamp}.${rawBody.toString()}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );

    if (!valid) {
      logger.warn("Firma de webhook inválida", { signature, timestamp });
      throw new AppError("Firma inválida", 401);
    }
  }
}
