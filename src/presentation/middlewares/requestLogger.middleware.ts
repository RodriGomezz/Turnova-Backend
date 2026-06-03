import { randomUUID }             from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger }                 from "../../infrastructure/logger";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

// Extraer el sub (userId) del JWT sin verificar la firma.
// Solo para logging — nunca usar para autenticar.
// Si el token es inválido o está ausente devuelve undefined.
function extractUserIdFromToken(req: Request): string | undefined {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return undefined;
    const payload = header.slice(7).split(".")[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof decoded.sub === "string" ? decoded.sub : undefined;
  } catch {
    return undefined;
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.requestId   = requestId;
  res.setHeader("x-request-id", requestId);

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status   = res.statusCode;
    const msg      = `${req.method} ${req.path} → ${status} (${duration}ms)`;

    // Contexto de usuario para debugging — priorizar los valores ya verificados
    // por authMiddleware (req.userId, req.businessId). Si no están disponibles
    // (ruta pública o error antes del middleware), intentar extraer del JWT sin verificar.
    const userId     = (req as any).userId     ?? (status >= 400 ? extractUserIdFromToken(req) : undefined);
    const businessId = (req as any).businessId ?? undefined;

    const meta = {
      requestId,
      method:   req.method,
      path:     req.path,
      status,
      duration,
      ip:       req.ip,
      ...(userId     ? { userId }     : {}),
      ...(businessId ? { businessId } : {}),
      // Body sanitizado solo en errores — logger.redact() cubre campos sensibles
      ...(status >= 400 && req.body && Object.keys(req.body).length > 0
        ? { body: req.body }
        : {}),
    };

    if (status >= 500)      logger.error(msg, meta);
    else if (status >= 400) logger.warn(msg, meta);
    else                    logger.http(msg, { requestId, duration });
  });

  next();
};