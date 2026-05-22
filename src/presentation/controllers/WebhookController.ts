import { Request, Response, NextFunction } from "express";
import {
  HandleWebhookUseCase,
  DLocalGoWebhookPayload,
} from "../../application/subscriptions/HandleWebhookUseCase";
import { AppError } from "../../domain/errors";
import { logger }  from "../../infrastructure/logger";
import crypto      from "crypto";

export class WebhookController {
  constructor(
    private readonly handleWebhookUseCase: HandleWebhookUseCase,
  ) {}

  handleDLocal = async (
    req:  Request,
    res:  Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawBody = req.body as Buffer;

      // ── [SEC-001] CRÍTICO: verificación de firma HMAC ─────────────────────
      //
      // Según la documentación oficial de dLocal Go, la firma se envía en el
      // header Authorization con el formato:
      //   "V2-HMAC-SHA256, Signature: <hex>"
      //
      // El mensaje que se firma es: apiKey + rawBody (NO solo rawBody).
      // El código anterior calculaba HMAC(rawBody, secret) — incorrecto.
      //
      // Sin verificación correcta, cualquier actor puede POST a este endpoint
      // y activar suscripciones sin pagar.
      const authHeader = req.headers["authorization"] as string | undefined;

      if (!authHeader) {
        logger.warn("Webhook dLocal Go rechazado: header Authorization ausente", {
          ip:        req.ip,
          userAgent: req.headers["user-agent"],
        });
        // Respondemos 200 para evitar reintentos, pero NO procesamos.
        res.status(200).json({ received: true });
        return;
      }

      // Extraer la firma del formato "V2-HMAC-SHA256, Signature: <hex>"
      const signatureMatch = authHeader.match(/Signature:\s*([a-f0-9]+)/i);
      if (!signatureMatch) {
        logger.warn("Webhook dLocal Go rechazado: formato de Authorization inválido", {
          authHeaderPrefix: authHeader.slice(0, 40),
        });
        res.status(200).json({ received: true });
        return;
      }

      const signature = signatureMatch[1];
      this.verifySignature(rawBody, signature);

      // ── Parse del payload ─────────────────────────────────────────────────
      // [SEC-002] dLocal Go solo envía { "payment_id": "..." }.
      // No logueamos el rawBody — puede contener datos sensibles.
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

      logger.info("Webhook dLocal Go recibido y verificado", {
        paymentId: payload.payment_id,
      });
      await this.handleWebhookUseCase.execute(payload);
      res.status(200).json({ received: true });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Verifica la firma HMAC-SHA256 del webhook de dLocal Go.
   *
   * Según la documentación oficial:
   *   Signature = HMAC('sha256', apiKey + rawBody, secretKey)
   *
   * El mensaje a firmar es la CONCATENACIÓN del apiKey con el rawBody —
   * no solo el rawBody como implementaba el código anterior.
   */
  private verifySignature(rawBody: Buffer, signature: string): void {
    const secret = process.env.DLOCAL_SECRET_KEY;
    const apiKey = process.env.DLOCAL_API_KEY;

    if (!secret || !apiKey) {
      logger.error(
        "DLOCAL_SECRET_KEY o DLOCAL_API_KEY no configurados — no se puede verificar firma",
      );
      throw new AppError("Error de configuración del servidor", 500);
    }

    // Mensaje = apiKey + rawBody (string), según especificación dLocal Go
    const message  = apiKey + rawBody.toString();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    // timingSafeEqual previene timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      logger.warn("Webhook dLocal Go: firma inválida rechazada", {
        signatureLength: signature.length,
        expectedLength:  expected.length,
      });
      throw new AppError("Firma de webhook inválida", 401);
    }
  }
}
