import { Response } from "express";
import { logger }   from "../logger";

/**
 * SseService — Server-Sent Events para notificaciones en tiempo real.
 *
 * Arquitectura de instancia única (singleton estático):
 *   - Funciona correctamente con una sola instancia del servidor.
 *   - Con múltiples instancias (horizontal scaling), reemplazar el Map
 *     por Redis Pub/Sub: el nodo que recibe el webhook publica el evento,
 *     todos los nodos suscritos lo reenvían a su cliente SSE local.
 *
 * Uso:
 *   // En el controller — registrar al cliente:
 *   SseService.addClient(businessId, res);
 *
 *   // En HandleWebhookUseCase — notificar al confirmar pago:
 *   SseService.notifyPaymentConfirmed(businessId);
 */
export class SseService {
  /** Map<businessId, Response> — un cliente SSE por negocio como máximo. */
  private static readonly clients = new Map<string, Response>();

  /** Intervalo en ms del heartbeat para mantener la conexión viva. */
  private static readonly HEARTBEAT_INTERVAL_MS = 20_000;

  /** Map<businessId, NodeJS.Timeout> — timers de heartbeat activos. */
  private static readonly heartbeats = new Map<string, NodeJS.Timeout>();

  /**
   * Registra una nueva conexión SSE para un businessId.
   * Si ya existía una conexión anterior para ese businessId, la cierra.
   */
  static addClient(businessId: string, res: Response): void {
    // Cerrar conexión anterior si existe (el usuario abrió otra pestaña)
    SseService.removeClient(businessId);

    // Cabeceras SSE estándar
    res.setHeader("Content-Type",       "text/event-stream");
    res.setHeader("Cache-Control",      "no-cache");
    res.setHeader("Connection",         "keep-alive");
    // Nginx: deshabilitar buffering para que los eventos fluyan de inmediato
    res.setHeader("X-Accel-Buffering",  "no");
    res.flushHeaders();

    SseService.clients.set(businessId, res);

    // Heartbeat: evita que proxies y load balancers cierren la conexión idle
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        SseService.removeClient(businessId);
        return;
      }
      res.write("event: ping\ndata: {}\n\n");
    }, SseService.HEARTBEAT_INTERVAL_MS);

    SseService.heartbeats.set(businessId, heartbeat);

    logger.info("SSE: cliente conectado", { businessId });
  }

  /**
   * Emite el evento `payment_confirmed` al cliente SSE del businessId dado.
   * Si no hay cliente conectado (usuario cerró la pestaña), solo loguea.
   */
  static notifyPaymentConfirmed(businessId: string): void {
    const client = SseService.clients.get(businessId);

    if (!client || client.writableEnded) {
      logger.info("SSE: sin cliente activo para notificar — pago confirmado en DB", {
        businessId,
      });
      return;
    }

    client.write('event: payment_confirmed\ndata: {"status":"active"}\n\n');
    logger.info("SSE: payment_confirmed enviado al cliente", { businessId });

    // Cerrar la conexión — ya cumplió su función
    SseService.removeClient(businessId);
  }

  /**
   * Limpia la conexión SSE y el heartbeat de un businessId.
   * Llamado al desconectar el cliente o tras emitir la notificación final.
   */
  static removeClient(businessId: string): void {
    const heartbeat = SseService.heartbeats.get(businessId);
    if (heartbeat) {
      clearInterval(heartbeat);
      SseService.heartbeats.delete(businessId);
    }

    const client = SseService.clients.get(businessId);
    if (client && !client.writableEnded) {
      client.end();
    }

    SseService.clients.delete(businessId);
    logger.info("SSE: cliente desconectado", { businessId });
  }

  /** Cantidad de clientes SSE activos (útil para monitoreo). */
  static get activeConnections(): number {
    return SseService.clients.size;
  }
}
