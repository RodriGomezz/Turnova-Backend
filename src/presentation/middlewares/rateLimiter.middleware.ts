import rateLimit, {
  Options,
  RateLimitExceededEventHandler,
} from "express-rate-limit";
import { logger } from "../../infrastructure/logger";

// ── Control explícito de desactivación ────────────────────────────────────────
// NUNCA usar NODE_ENV para esto: staging hereda NODE_ENV=development y queda
// desprotegido. Con DISABLE_RATE_LIMIT=true el equipo lo activa conscientemente.
const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

if (isRateLimitDisabled) {
  logger.warn(
    "⚠️  Rate limiting DESACTIVADO — DISABLE_RATE_LIMIT=true. " +
      "Nunca usar en producción ni staging.",
  );
}

// ── Handler base ──────────────────────────────────────────────────────────────

function makeHandler(message: string): RateLimitExceededEventHandler {
  return (req, res, _next, options: Partial<Options>) => {
    logger.warn("Rate limit alcanzado", {
      ip:      req.ip,
      method:  req.method,
      path:    req.path,
      max:     options.max,
      windowS: options.windowMs ? options.windowMs / 1000 : undefined,
    });
    res.status(429).json({ error: message });
  };
}

// ── generalLimiter ─────────────────────────────────────────────────────────────
// Rutas del panel autenticado. Un usuario real difícilmente supera 200 req en
// 15 min navegando el panel. El límite es una red de seguridad contra scraping.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled,
  handler: makeHandler("Demasiadas solicitudes, intentá en unos minutos"),
});

// ── authLimiter ────────────────────────────────────────────────────────────────
// Login / register / refresh. Protege contra brute force de credenciales.
// 20 intentos en 15 min es razonable para uso legítimo (ej: olvidó contraseña
// y reintenta varias veces). Más de eso es sospechoso.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled,
  handler: makeHandler("Demasiados intentos, esperá unos minutos"),
});

// ── slotLimiter ────────────────────────────────────────────────────────────────
// GET /public/:slug/slots — consulta de disponibilidad.
//
// Análisis de uso legítimo:
//   - Un cliente que busca turno: cambia día ~5 veces, cambia profesional ~3 veces
//     = ~8-15 consultas en una sesión de ~5 minutos.
//   - Un cliente indeciso o que vuelve al paso anterior: hasta ~25-30 consultas.
//   - Scraper básico: cientos de req en pocos segundos.
//
// Decisión: 60 req / 2 min por IP.
//   → Un cliente normal nunca lo alcanza.
//   → Un scraper o bot lo alcanza en segundos y queda bloqueado 2 min (suficiente
//     para que no sea rentable sin ser punitivo con usuarios reales).
export const slotLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,   // ventana de 2 min (corta — se reinicia rápido)
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled,
  handler: makeHandler(
    "Demasiadas consultas de disponibilidad, esperá unos segundos",
  ),
});

// ── bookingLimiter ─────────────────────────────────────────────────────────────
// POST /public/:slug — creación de reservas.
//
// Análisis de uso legítimo:
//   - Un cliente real crea 1-3 reservas por sesión (para él y acompañantes).
//   - Un negocio que llama su propia API desde el panel usa authMiddleware, no esta ruta.
//   - Abusos: bots que llenan la agenda, denial-of-service de slots.
//
// Decisión: 10 req / 10 min por IP.
//   → Crea 10 reservas seguidas sin problema (grupo familiar, recepcionista de hotel).
//   → Después de 10 min la ventana se reinicia — no queda bloqueado una hora.
//   → Un bot que intenta llenar la agenda frena casi de inmediato.
//
// ⚠️  Si en el futuro se agrega autenticación opcional en reservas públicas,
//     se puede combinar IP + userId para ser más preciso.
export const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 min (antes: 60 min — demasiado punitivo)
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled,
  handler: makeHandler(
    "Demasiadas reservas en poco tiempo, esperá unos minutos",
  ),
});

// ── publicLimiter ──────────────────────────────────────────────────────────────
// GET /public/:slug — carga de página pública del negocio.
// Esta ruta YA tiene caché en memoria (public.cache.ts), así que la mayoría de
// requests ni siquiera llegan a la DB. El límite es solo contra floods.
export const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,   // 1 min
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled,
  handler: makeHandler("Demasiadas solicitudes"),
});
