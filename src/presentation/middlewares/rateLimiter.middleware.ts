import rateLimit, {
  ipKeyGenerator,
  Options,
  RateLimitExceededEventHandler,
  RateLimitRequestHandler,
} from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { logger } from "../../infrastructure/logger";

const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

if (isRateLimitDisabled) {
  logger.warn("Rate limiting DESACTIVADO — nunca usar en producción.");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIpKeyGenerator(req: Request): string {
  return ipKeyGenerator(req.ip ?? "");
}

function makeHandler(message: string): RateLimitExceededEventHandler {
  return (req, res, _next, options: Partial<Options>) => {
    logger.warn("Rate limit alcanzado", {
      ip:     makeIpKeyGenerator(req),
      method: req.method,
      path:   req.path,
      max:    options.max,
      window: options.windowMs ? options.windowMs / 1000 : undefined,
    });
    res.status(429).json({ error: message });
  };
}

const baseOptions = {
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  keyGenerator:    makeIpKeyGenerator,
} satisfies Partial<Options>;

// ── Auth ──────────────────────────────────────────────────────────────────────

// Límite por IP: 30 req / 15 min — cubre 3 empleados en la misma red WiFi
export const loginLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs:              15 * 60 * 1000,
  max:                   150,
  skipSuccessfulRequests: true,
  handler:               makeHandler(
    "Demasiados intentos desde esta red. Esperá 15 minutos.",
  ),
});

// Límite por email: 5 intentos / 15 min — bloquea fuerza bruta a una cuenta
// sin afectar a otros empleados en la misma red.
const loginAttemptsByEmail = new Map<string, { count: number; resetAt: number }>();
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX       = 20;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttemptsByEmail) {
    if (entry.resetAt <= now) loginAttemptsByEmail.delete(key);
  }
}, EMAIL_WINDOW_MS).unref();

export function loginByEmailLimiter(req: Request, res: Response, next: NextFunction): void {
  if (isRateLimitDisabled) { next(); return; }

  const email = (req.body?.email as string | undefined)?.toLowerCase().trim();
  if (!email) { next(); return; }

  const now   = Date.now();
  const entry = loginAttemptsByEmail.get(email);

  if (entry && entry.resetAt > now) {
    if (entry.count >= EMAIL_MAX) {
      const waitMins = Math.ceil((entry.resetAt - now) / 60_000);
      logger.warn("Rate limit por email en login", {
        email: email.slice(0, 3) + "***",
        count: entry.count,
        waitMins,
      });
      res.status(429).json({
        error: `Demasiados intentos para esta cuenta. Esperá ${waitMins} minuto${waitMins !== 1 ? "s" : ""}.`,
      });
      return;
    }
  }

  res.on("finish", () => {
    if (![401, 403].includes(res.statusCode)) return;

    const current = loginAttemptsByEmail.get(email);
    if (current && current.resetAt > Date.now()) {
      current.count++;
      return;
    }

    loginAttemptsByEmail.set(email, {
      count:   1,
      resetAt: Date.now() + EMAIL_WINDOW_MS,
    });
  });

  next();
}

// skipFailedRequests: intentos con 4xx (email ya existe, validación) no cuentan
export const registerLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs:           15 * 60 * 1000,
  max:                50,
  skipFailedRequests: true,
  handler:            makeHandler("Demasiados intentos de registro. Esperá 15 minutos."),
});

export const authBurstLimiter: RateLimitRequestHandler = loginLimiter;

export const refreshLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      300,
  handler:  makeHandler("Demasiadas renovaciones de sesión. Esperá unos minutos."),
});

export const resetLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      5,
  handler:  makeHandler(
    "Demasiados intentos de recuperación. Esperá 15 minutos y revisá tu carpeta de spam.",
  ),
});

// ── Panel ─────────────────────────────────────────────────────────────────────

export const generalLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      1000,
  handler:  makeHandler("Demasiadas solicitudes. Esperá unos minutos."),
});

export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max:      20,
  handler:  makeHandler("Límite de subidas alcanzado. Podés subir hasta 20 imágenes cada 10 minutos."),
});

// ── Público ───────────────────────────────────────────────────────────────────

export const slotLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 2 * 60 * 1000,
  max:      60,
  handler:  makeHandler("Demasiadas consultas de disponibilidad. Esperá unos segundos."),
});

export const bookingLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max:      20,
  handler:  makeHandler("Demasiadas reservas en poco tiempo. Esperá unos minutos."),
});

export const publicLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 1 * 60 * 1000,
  max:      200,
  handler:  makeHandler("Demasiadas solicitudes. Esperá un momento."),
});

// ── Infraestructura ───────────────────────────────────────────────────────────

export const healthLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 5 * 60 * 1000,
  max:      60,
  handler:  makeHandler("Demasiadas solicitudes al health check."),
});
