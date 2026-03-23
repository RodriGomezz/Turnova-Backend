import rateLimit, {
  Options,
  RateLimitExceededEventHandler,
} from "express-rate-limit";
import { logger } from "../../infrastructure/logger";

const isDev = process.env.NODE_ENV !== "production";

function onLimitReached(
  req: Parameters<RateLimitExceededEventHandler>[0],
  options: Partial<Options>,
): void {
  logger.warn("Rate limit alcanzado", {
    ip: req.ip,
    method: req.method,
    path: req.path,
    max: options.max,
    windowS: options.windowMs ? options.windowMs / 1000 : undefined,
  });
}

function makeHandler(message: string): RateLimitExceededEventHandler {
  return (req, res, _next, options) => {
    onLimitReached(req, options);
    res.status(429).json({ error: message });
  };
}

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  handler: makeHandler("Demasiadas solicitudes, intentá en unos minutos"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  handler: makeHandler("Demasiados intentos, esperá 15 minutos"),
});

export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  handler: makeHandler("Límite de reservas alcanzado, intentá en una hora"),
});

export const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  handler: makeHandler("Demasiadas solicitudes"),
});
