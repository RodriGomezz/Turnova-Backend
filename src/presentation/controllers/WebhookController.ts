import { Request, Response, NextFunction } from "express";
import {
  HandleWebhookUseCase,
  DLocalGoWebhookPayload,
} from "../../application/subscriptions/HandleWebhookUseCase";
import { AppError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";
import crypto from "crypto";

export class WebhookController {
  constructor(
    private readonly handleWebhookUseCase: HandleWebhookUseCase,
  ) {}

  /**
   * POST /api/subscriptions/dlocal
   *
   * dLocal Go envía: { payment_id: "xxx", order_id: "yyy", status: "PAID" }
   *
   * La firma usa HMAC-SHA256 sobre el body raw con el API Secret como clave.
   * Header: X-Signature
   */
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
        logger.warn("Webhook recibido sin X-Signature — omitiendo verificación");
      }

      const rawBody = (req.body as Buffer).toString();
      // logger.info("Webhook payload raw", { body: JSON.stringify({ raw: rawBody }) });
      // logger.info("Webhook debug", { 
      //   bodyType: typeof req.body,
      //   isBuffer: Buffer.isBuffer(req.body),
      //   bodyKeys: req.body ? Object.keys(req.body) : [],
      //   rawLength: rawBody.length,
      //   rawSample: rawBody.substring(0, 100),
      // });
      // console.log("WEBHOOK BODY:", req.body);
      // console.log("WEBHOOK RAW:", rawBody);
      // console.log("WEBHOOK IS BUFFER:", Buffer.isBuffer(req.body));
      let payload: DLocalGoWebhookPayload;

      try {
        payload = JSON.parse(rawBody) as DLocalGoWebhookPayload;
      } catch {
        throw new AppError("Payload de webhook inválido", 400);
      }

      if (!payload.payment_id) {
        throw new AppError("Webhook sin payment_id", 400);
      }

      // Responder 200 de inmediato — dLocal reintenta si no recibe respuesta rápida
      res.status(200).json({ received: true });

      // Procesar de forma asíncrona sin bloquear la respuesta
      this.handleWebhookUseCase.execute(payload).catch((err) =>
        logger.error("Error procesando webhook dLocal Go", {
          paymentId: payload.payment_id,
          err,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  // ── Helpers privados ──────────────────────────────────────────────────────

  private verifySignature(rawBody: Buffer, signature: string): void {
    const secret = process.env.DLOCAL_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn("DLOCAL_WEBHOOK_SECRET no configurado — verificación omitida");
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
