import { randomUUID } from "crypto";
import { logger }     from "../logger";

interface SseTokenEntry {
  businessId: string;
  userId:     string;
  expiresAt:  number;
}

/**
 * Store en memoria para tokens SSE efímeros de un solo uso.
 *
 * Problema que resuelve: EventSource del navegador no soporta headers HTTP
 * personalizados, por lo que no puede enviar `Authorization: Bearer <jwt>`.
 * La solución anterior (pasar el JWT como ?token= en la URL) lo exponía en
 * logs de servidor, historial del navegador y headers Referer.
 *
 * Flujo correcto:
 *   1. Frontend llama POST /subscriptions/sse-token (con JWT en header normal)
 *   2. Recibe un UUID de un solo uso válido 60 segundos
 *   3. Abre EventSource con ?sse_token=<uuid> — el JWT nunca toca la URL
 *   4. El token se consume al primer request y se elimina del store
 *
 * Propiedades de seguridad:
 *   - TTL de 60 segundos (suficiente para abrir la conexión)
 *   - Un solo uso: se elimina al ser consumido, no al expirar
 *   - Sin persistencia: reiniciar el servidor invalida todos los tokens
 *   - Scope restringido: no válido para ningún endpoint que no sea confirm-stream
 */
class SseTokenStore {
  private readonly store = new Map<string, SseTokenEntry>();
  private readonly TTL_MS = 60_000;

  constructor() {
    // Limpiar tokens vencidos cada minuto para evitar memory leak
    // en escenarios donde el frontend emite el token pero no abre el SSE
    setInterval(() => this.cleanup(), 60_000).unref();
  }

  /**
   * Emite un token efímero y lo registra en el store.
   * @returns El UUID generado, listo para enviarse al frontend.
   */
  issue(businessId: string, userId: string): string {
    const token = randomUUID();
    this.store.set(token, {
      businessId,
      userId,
      expiresAt: Date.now() + this.TTL_MS,
    });
    return token;
  }

  /**
   * Consume el token: lo valida, lo elimina del store (un solo uso) y
   * devuelve los datos asociados, o `null` si es inválido o expiró.
   */
  consume(token: string): Pick<SseTokenEntry, "businessId" | "userId"> | null {
    const entry = this.store.get(token);

    if (!entry) {
      logger.warn("SSE token inválido o ya consumido", { token: token.slice(0, 8) });
      return null;
    }

    // Eliminar siempre — expirado o no — para garantizar un solo uso
    this.store.delete(token);

    if (entry.expiresAt < Date.now()) {
      logger.warn("SSE token expirado", { token: token.slice(0, 8) });
      return null;
    }

    return { businessId: entry.businessId, userId: entry.userId };
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [token, entry] of this.store) {
      if (entry.expiresAt < now) {
        this.store.delete(token);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug("SSE token store: tokens expirados eliminados", { removed });
    }
  }
}

// Singleton — una sola instancia para toda la vida del proceso
export const sseTokenStore = new SseTokenStore();