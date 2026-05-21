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
      const rawBody = req.body as Buffer;

      // ── [SEC-001] CRÍTICO: Firma obligatoria ──────────────────────────────
      // La verificación de firma NO es opcional. Sin ella cualquiera puede
      // realizar un POST y activar suscripciones sin pagar.
      const signature = req.headers["x-signature"] as string | undefined;
      if (!signature) {
        logger.warn("Webhook dLocal Go rechazado: X-Signature ausente", {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
        // Devolvemos 200 para evitar que dLocal Go reintente indefinidamente,
        // pero NO procesamos el payload.
        res.status(200).json({ received: true });
        return;
      }

      this.verifySignature(rawBody, signature);

      // ── Parse del payload ─────────────────────────────────────────────────
      // [SEC-002] NO logueamos el raw body completo: puede contener tokens
      // de tarjeta o datos PCI. Solo logueamos metadatos no sensibles.
      let payload: DLocalGoWebhookPayload;
      try {
        payload = JSON.parse(rawBody.toString()) as DLocalGoWebhookPayload;
      } catch {
        logger.error("Webhook dLocal Go: payload no es JSON válido", {
          contentLength: rawBody.length,
        });
        res.status(200).json({ received: true });
        return;
      }

      // Log mínimo: solo identificadores, nunca el payload completo
      logger.info("Webhook dLocal Go recibido y verificado", {
        externalId:     payload.external_id ?? payload.externalId,
        subscriptionId: payload.subscription_id ?? payload.subscriptionId,
        invoiceId:      payload.order_id ?? payload.invoiceId,
        status:         payload.status,
        mid:            payload.mid,
      });

      // Buscar identificadores en todos los campos posibles del payload
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
        logger.warn("Webhook dLocal Go sin identificadores", {
          keys: Object.keys(payload),
        });
        res.status(200).json({ received: true });
        return;
      }

      const normalizedPayload: DLocalGoWebhookPayload = {
        ...payload,
        subscription_token: subscriptionToken,
        plan_token:         planToken,
        external_id:        externalId,
        order_id:           orderId,
      };

      await this.handleWebhookUseCase.execute(normalizedPayload);

      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };

  private verifySignature(rawBody: Buffer, signature: string): void {
    const secret = process.env.DLOCAL_SECRET_KEY;
    if (!secret) {
      // Si el secret no está configurado en producción, es un error de
      // infraestructura — no silencioso, lanzamos para que el proceso falle ruidoso.
      logger.error("DLOCAL_SECRET_KEY no configurado — no se puede verificar firma");
      throw new AppError("Error de configuración del servidor", 500);
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // timingSafeEqual previene timing attacks
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      logger.warn("Webhook dLocal Go: firma inválida rechazada", {
        signatureLength: signature.length,
      });
      throw new AppError("Firma de webhook inválida", 401);
    }
  }
}
