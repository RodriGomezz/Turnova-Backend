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

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Correlation ID: reutilizar el del cliente si viene (útil para tracing
  // distribuido), generar uno nuevo si no.
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.requestId   = requestId;
  res.setHeader("x-request-id", requestId);

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status   = res.statusCode;
    const msg      = `${req.method} ${req.path} → ${status} (${duration}ms)`;

    const meta = {
      requestId,
      method:   req.method,
      path:     req.path,
      status,
      duration,
      ip:       req.ip,
      // Loguear body sanitizado en errores para facilitar debugging en producción.
      // El logger.redact() cubre campos sensibles antes de escribir.
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