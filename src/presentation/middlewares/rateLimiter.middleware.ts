import rateLimit, {
  ipKeyGenerator,
  Options,
  RateLimitExceededEventHandler,
  RateLimitRequestHandler,
} from "express-rate-limit";
import { Request } from "express";
import { logger } from "../../infrastructure/logger";

const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

if (isRateLimitDisabled) {
  logger.warn(
    "⚠️  Rate limiting DESACTIVADO — DISABLE_RATE_LIMIT=true. " +
      "Nunca usar en producción ni staging.",
  );
}

// ── keyGenerator IPv6-safe ────────────────────────────────────────────────────
function makeIpKeyGenerator(req: Request): string {
  return ipKeyGenerator(req.ip ?? "");
}

// ── Handler base ──────────────────────────────────────────────────────────────
// Cada handler incluye un mensaje claro y accionable para el usuario.
// También logea la IP, método y path para detección de abusos.
function makeHandler(message: string): RateLimitExceededEventHandler {
  return (req, res, _next, options: Partial<Options>) => {
    logger.warn("Rate limit alcanzado", {
      ip:      makeIpKeyGenerator(req),
      method:  req.method,
      path:    req.path,
      max:     options.max,
      windowS: options.windowMs ? options.windowMs / 1000 : undefined,
    });
    res.status(429).json({ error: message });
  };
}

// ── Opciones base compartidas ─────────────────────────────────────────────────
const baseOptions = {
  standardHeaders: true,   // devuelve RateLimit-* headers al cliente
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  keyGenerator:    makeIpKeyGenerator,
} satisfies Partial<Options>;

// ── generalLimiter — panel autenticado ───────────────────────────────────────
// 500 req / 15 min: un negocio con polling intensivo hace ~40-60 req en ese
// período. Margen de 8x — el usuario legítimo nunca lo alcanza.
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      500,
  handler:  makeHandler(
    "Demasiadas solicitudes. Esperá unos minutos antes de continuar.",
  ),
});

// ── authLimiter — login / register ───────────────────────────────────────────
// 10 req / 15 min: alineado con Node.js Best Practices. Un humano olvidadizo
// no supera 5 intentos de login.
export const authLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      10,
  handler:  makeHandler(
    "Demasiados intentos. Esperá 15 minutos antes de volver a intentarlo.",
  ),
});

// ── refreshLimiter — POST /auth/refresh ──────────────────────────────────────
// Con tokens de 5 min de expiración (nuevo sistema asimétrico de Supabase),
// un usuario activo durante 8 horas hace ~96 refreshes automáticos.
// 200 req / 15 min por IP cubre hasta ~10 usuarios simultáneos en la misma
// red sin bloquearlos, mientras sigue bloqueando floods automatizados.
export const refreshLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      200,
  handler:  makeHandler(
    "Demasiadas renovaciones de sesión. Esperá unos minutos.",
  ),
});

// ── healthLimiter — GET /health ───────────────────────────────────────────────
// UptimeRobot pinea cada 5 min = 12 req/hora = 288 req/día.
// 60 req / 5 min es más que suficiente para el monitor + buffer de reintentos.
export const healthLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 5 * 60 * 1000,
  max:      60,
  handler:  makeHandler("Demasiadas solicitudes al health check."),
});

// ── resetLimiter — request-reset y reset-password ────────────────────────────
// 5 req / 15 min: estándar de la industria para envío de emails de reset
// (Postman, Cloudflare: 3-5 req / 15 min). Más restrictivo que authLimiter
// porque dispara envío de email real y el token es sensible.
export const resetLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max:      5,
  handler:  makeHandler(
    "Demasiados intentos de recuperación de contraseña. " +
    "Esperá 15 minutos. Revisá también tu carpeta de spam.",
  ),
});

// ── uploadLimiter — POST /api/upload/* ───────────────────────────────────────
// 20 req / 10 min: cada upload llama a Vercel/S3 con costo real de red y
// almacenamiento. Un usuario que sube fotos de perfil/negocio raramente
// supera 5-8 uploads en una sesión de configuración.
export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max:      20,
  handler:  makeHandler(
    "Límite de subidas alcanzado. Podés subir hasta 20 imágenes cada 10 minutos.",
  ),
});

// ── slotLimiter — GET /slots y /available-days-with-slots ───────────────────
// 60 req / 2 min: usuario real hace ~15-25 consultas explorando el calendario.
// Un scraper lo alcanza en segundos y queda bloqueado solo 2 minutos.
export const slotLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 2 * 60 * 1000,
  max:      60,
  handler:  makeHandler(
    "Demasiadas consultas de disponibilidad. Esperá unos segundos.",
  ),
});

// ── bookingLimiter — POST /public/:slug (crear reserva) ──────────────────────
// 10 req / 10 min: cubre grupos (varias reservas seguidas). Ventana corta de
// 10 min (no 60 min) para no bloquear al usuario por una hora entera.
export const bookingLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max:      10,
  handler:  makeHandler(
    "Demasiadas reservas en poco tiempo. Esperá unos minutos para continuar.",
  ),
});

// ── publicLimiter — GET /public/:slug y /slug-check ─────────────────────────
// 120 req / 1 min: la caché en memoria absorbe el 90% de estos requests.
// El límite es solo contra floods — un usuario real nunca supera 10 req/min.
export const publicLimiter: RateLimitRequestHandler = rateLimit({
  ...baseOptions,
  windowMs: 1 * 60 * 1000,
  max:      120,
  handler:  makeHandler("Demasiadas solicitudes. Esperá un momento."),
});

// ── Aliases de compatibilidad con imports del agente de frontend ──────────────
export { authLimiter as authBurstLimiter };
export { authLimiter as loginLimiter };