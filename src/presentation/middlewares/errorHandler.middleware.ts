import { Request, Response, NextFunction } from "express";
import { logger } from "../../infrastructure/logger";
import { AppError } from "../../domain/errors";

// Re-exportar para que los imports existentes de presentation no se rompan
export {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "../../domain/errors";

// SEC-007: usar variable explícita en lugar de NODE_ENV.
// Si NODE_ENV=development en staging, los stack traces llegarían al cliente.
// Con EXPOSE_ERROR_STACK=true el equipo lo activa conscientemente solo donde necesita.
const exposeStack = process.env.EXPOSE_ERROR_STACK === "true";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error("Error operacional 5xx", {
        message: err.message,
        path: req.path,
        method: req.method,
      });
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.name,
      ...(exposeStack && { stack: err.stack }),
    });
    return;
  }

  logger.error("Error inesperado", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    error: exposeStack ? err.message : "Error interno del servidor",
    code: "INTERNAL_ERROR",
    ...(exposeStack && { stack: err.stack }),
  });
};
