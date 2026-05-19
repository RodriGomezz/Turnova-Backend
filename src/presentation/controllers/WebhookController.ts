import { Request, Response, NextFunction } from "express";
import {
  HandleWebhookUseCase,
  DLocalGoWebhookPayload,
} from "../../application/subscriptions/HandleWebhookUseCase";
import {
  HandleMPWebhookUseCase,
  MPWebhookPayload,
} from "../../application/subscriptions/Handlempwebhookusecase";
import { AppError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";
import crypto from "crypto";

/**
 * WebhookController — maneja los webhooks de ambos proveedores.
 *
 * RUTAS:
 *   POST /api/subscriptions/mercadopago  → handleMercadoPago  ← ACTIVO
 *   POST /api/subscriptions/dlocal       → handleDLocal        ← DESACTIVADO (mantiene el código)
 *
 * Verificación de firma de MP:
 *   x-signature header: "ts=1704908010,v1=hash"
 *   Mensaje a firmar: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 *   HMAC-SHA256 con MP_WEBHOOK_SECRET
 *
 * Docs firma MP:
 *   https://www.mercadopago.com/developers/es/docs/your-integrations/notifications/webhooks#configuracindelafirmasecreta
 */
export class WebhookController {
  constructor(
    private readonly handleDLocalWebhookUseCase: HandleWebhookUseCase,
    private readonly handleMPWebhookUseCase: HandleMPWebhookUseCase,
  ) {}

  // ── MercadoPago — PROVEEDOR ACTIVO ────────────────────────────────────────

  handleMercadoPago = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // MP envía JSON normal (no necesita raw buffer para verificar firma,
      // la firma se basa en campos del payload + header, no en el body raw)
      const payload = req.body as MPWebhookPayload;

      // Verificar firma si el secret está configurado
      const xSignature  = req.headers["x-signature"] as string | undefined;
      const xRequestId  = req.headers["x-request-id"] as string | undefined;

      if (xSignature) {
        this.verifyMPSignature(xSignature, xRequestId, payload);
      } else {
        logger.warn("MP webhook recibido sin x-signature — omitiendo verificación");
      }

      logger.info("MP webhook recibido", {
        type:      payload.type,
        action:    payload.action,
        eventId:   payload.id,
        dataId:    payload.data?.id,
        liveMode:  payload.live_mode,
      });

      // Responder 200 INMEDIATAMENTE — MP reintenta si no recibe respuesta rápido.
      // Procesamos el evento de forma asíncrona después de responder.
      res.status(200).json({ received: true });

      // Procesar en background (no bloquea la respuesta HTTP)
      this.handleMPWebhookUseCase.execute(payload).catch((err) =>
        logger.error("MP webhook: error procesando evento", {
          err,
          type:    payload.type,
          eventId: payload.id,
          dataId:  payload.data?.id,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  // ── dLocal Go — DESACTIVADO (código preservado para reactivar si necesario) ─

  /**
   * @deprecated — dLocal Go desactivado. Proveedor activo: MercadoPago.
   * Descomentar en subscription.routes.ts para reactivar.
   */
  handleDLocal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers["x-signature"] as string | undefined;
      if (signature) {
        this.verifyDLocalSignature(req.body as Buffer, signature);
      } else {
        logger.warn("Webhook dLocal Go recibido sin X-Signature — omitiendo verificación");
      }

      const rawBody = (req.body as Buffer).toString();
      let payload: DLocalGoWebhookPayload;

      try {
        payload = JSON.parse(rawBody) as DLocalGoWebhookPayload;
      } catch {
        logger.error("dLocal webhook: payload no es JSON válido", { rawBody });
        res.status(200).json({ received: true });
        return;
      }

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

      const hasIdentifier =
        subscriptionToken || planToken || externalId || orderId || payload.id;

      if (!hasIdentifier) {
        logger.warn("dLocal webhook sin identificadores", {
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

      await this.handleDLocalWebhookUseCase.execute(normalizedPayload);
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };

  // ── Verificación de firma MP ───────────────────────────────────────────────

  /**
   * Verifica la firma de MP según la documentación oficial:
   * https://www.mercadopago.com/developers/es/docs/your-integrations/notifications/webhooks
   *
   * Algoritmo:
   *   1. Extraer ts y v1 del header x-signature ("ts=...,v1=...")
   *   2. Construir el string a firmar: "id:{data.id};request-id:{x-request-id};ts:{ts};"
   *   3. HMAC-SHA256(MP_WEBHOOK_SECRET, string) en hex
   *   4. Comparar con v1 usando timingSafeEqual
   */
  private verifyMPSignature(
    xSignature: string,
    xRequestId: string | undefined,
    payload: MPWebhookPayload,
  ): void {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn("MP_WEBHOOK_SECRET no configurado — verificación de firma omitida");
      return;
    }

    // Parsear "ts=1234567890,v1=abc123..."
    const parts: Record<string, string> = {};
    for (const part of xSignature.split(",")) {
      const [key, value] = part.split("=");
      if (key && value) parts[key.trim()] = value.trim();
    }

    const ts = parts["ts"];
    const v1 = parts["v1"];

    if (!ts || !v1) {
      logger.warn("MP webhook: x-signature malformado", { xSignature });
      throw new AppError("Firma de webhook MP inválida", 401);
    }

    // Construir el mensaje a firmar
    const dataId    = payload.data?.id ?? "";
    const requestId = xRequestId ?? "";

    // Formato: "id:{data.id};request-id:{x-request-id};ts:{ts};"
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    // Comparación en tiempo constante para prevenir timing attacks
    if (
      v1.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"))
    ) {
      logger.warn("MP webhook: firma inválida", { ts, requestId, dataId });
      throw new AppError("Firma de webhook MP inválida", 401);
    }

    logger.info("MP webhook: firma verificada OK", { ts, dataId });
  }

  // ── Verificación de firma dLocal ──────────────────────────────────────────

  private verifyDLocalSignature(rawBody: Buffer, signature: string): void {
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
      logger.warn("dLocal webhook: firma inválida");
      throw new AppError("Firma de webhook dLocal inválida", 401);
    }
  }
}