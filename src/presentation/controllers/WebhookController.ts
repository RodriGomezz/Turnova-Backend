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

  handleDLocal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers["x-signature"] as string | undefined;
      if (signature) {
        this.verifySignature(req.body as Buffer, signature);
      } else {
        logger.warn("Webhook dLocal Go recibido sin X-Signature — omitiendo verificación");
      }

      // Loggear raw body completo para diagnóstico
      const rawBody = (req.body as Buffer).toString();
      logger.warn("Webhook dLocal Go raw body", { rawBody, headers: req.headers });

      let payload: DLocalGoWebhookPayload;
      try {
        payload = JSON.parse(rawBody) as DLocalGoWebhookPayload;
      } catch {
        logger.error("Webhook payload no es JSON válido", { rawBody });
        res.status(200).json({ received: true });
        return;
      }

      logger.warn("Webhook dLocal Go payload parseado", { payload: JSON.stringify(payload) });

      // Buscar identificadores en todos los campos posibles del payload
      // dLocal Go puede enviar los datos con distintos nombres de campo
      const subscriptionToken =
        payload.subscription_token ??
        (payload as Record<string, unknown>)["subscriptionToken"] as string | undefined;

      const planToken =
        payload.plan_token ??
        (payload as Record<string, unknown>)["planToken"] as string | undefined;

      const externalId =
        payload.external_id ??
        (payload as Record<string, unknown>)["externalId"] as string | undefined;

      const orderId =
        payload.order_id ??
        (payload as Record<string, unknown>)["orderId"] as string | undefined;

      const id = payload.id;

      const hasIdentifier = subscriptionToken || planToken || externalId || orderId || id;

      if (!hasIdentifier) {
        logger.warn("Webhook dLocal Go sin identificadores — payload completo:", {
          keys: Object.keys(payload),
          payload,
        });
        res.status(200).json({ received: true });
        return;
      }

      // Normalizar al formato esperado por HandleWebhookUseCase
      const normalizedPayload: DLocalGoWebhookPayload = {
        ...payload,
        subscription_token: subscriptionToken,
        plan_token:         planToken,
        external_id:        externalId,
        order_id:           orderId,
      };

      res.status(200).json({ received: true });

      this.handleWebhookUseCase.execute(normalizedPayload).catch((err) =>
        logger.error("Error procesando webhook dLocal Go", {
          subscriptionToken,
          planToken,
          externalId,
          orderId,
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

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      logger.warn("Firma de webhook inválida");
      throw new AppError("Firma de webhook inválida", 401);
    }
  }
}