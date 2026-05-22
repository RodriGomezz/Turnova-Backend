import rateLimit, { Options, RateLimitExceededEventHandler, RateLimitRequestHandler } from 'express-rate-limit';
import { Request } from 'express';
import { logger } from '../../infrastructure/logger';

const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';

if (isRateLimitDisabled) {
  logger.warn(
    '⚠️  Rate limiting DESACTIVADO — DISABLE_RATE_LIMIT=true. ' +
    'Nunca usar en producción ni staging.',
  );
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function makeHandler(message: string): RateLimitExceededEventHandler {
  return (req, res, _next, options: Partial<Options>) => {
    logger.warn('Rate limit alcanzado', {
      ip:      req.ip,
      userId:  (req as any).userId ?? 'anon',
      method:  req.method,
      path:    req.path,
      max:     options.max,
      windowS: options.windowMs ? options.windowMs / 1000 : undefined,
    });
    res.status(429).json({ error: message });
  };
}

function getAuthIdentityKey(req: Request): string {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
  const email    = rawEmail.trim().toLowerCase();
  return `${req.ip}:${email || 'anon'}`;
}

/**
 * Key para rutas del panel autenticado.
 *
 * authMiddleware corre DENTRO del router, DESPUÉS de que app.use() registra
 * el limiter — por eso req.userId es undefined en ese punto.
 *
 * Solución: leer el userId del JWT directamente en el keyGenerator, sin
 * verificar firma (eso ya lo hace authMiddleware). El limiter solo necesita
 * una key estable por usuario; la verificación de autenticidad es ortogonal.
 *
 * Si el token está ausente o malformado → fallback a IP (el request fallará
 * en authMiddleware de todas formas, el limiter no necesita validarlo).
 */
function getPanelIdentityKey(req: Request): string {
  try {
    const authHeader = req.headers.authorization ?? '';
    const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return req.ip ?? 'unknown';

    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );

    // sub es el userId de Supabase — estable y único por usuario
    return typeof payload.sub === 'string' ? `user:${payload.sub}` : (req.ip ?? 'unknown');
  } catch {
    return req.ip ?? 'unknown';
  }
}

// ── generalLimiter ────────────────────────────────────────────────────────────
// Rutas del panel autenticado. Key por userId — cada usuario tiene su propia
// cuota, independientemente de cuántos compartan la misma IP de oficina.
// 600 req/15min = 40 req/min sostenidos → imposible de alcanzar en uso normal.
// Aumentado de 500 a 600 para absorber sesiones intensas sin riesgo de bloqueo.
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            600,
  standardHeaders: true,
  legacyHeaders:  false,
  skip:           () => isRateLimitDisabled,
  keyGenerator:   getPanelIdentityKey,
  handler:        makeHandler('Demasiadas solicitudes, intentá en unos minutos'),
});

// ── authLimiter ───────────────────────────────────────────────────────────────
// Register / request-reset. Protege contra enumeración de cuentas.
// Key por IP — estas rutas no tienen userId aún.
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  handler:         makeHandler('Demasiados intentos, esperá unos minutos'),
});

// ── loginLimiter ──────────────────────────────────────────────────────────────
// Brute force de credenciales. Key por IP+email para no penalizar IPs
// compartidas (ej: todos los empleados de una empresa detrás del mismo NAT).
export const loginLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:              10 * 60 * 1000,
  max:                   10,
  standardHeaders:       true,
  legacyHeaders:         false,
  skip:                  () => isRateLimitDisabled,
  skipSuccessfulRequests: true,
  keyGenerator:          getAuthIdentityKey,
  handler:               makeHandler(
    'Demasiados intentos de acceso. Esperá unos minutos o recuperá tu contraseña.',
  ),
});

// ── authBurstLimiter ──────────────────────────────────────────────────────────
// Flood sobre endpoints de auth públicos (login, register, reset).
// Key por IP — misma razón que authLimiter.
export const authBurstLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  handler:         makeHandler(
    'Demasiadas solicitudes de autenticación, intentá nuevamente en unos minutos',
  ),
});

// ── refreshLimiter ────────────────────────────────────────────────────────────
// Refresh de token — automático y transparente al usuario.
// Key por userId extraído del token (el refresh token tiene sub en el payload).
// 60 refrescos en 15 min: imposible de alcanzar en uso legítimo.
export const refreshLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  keyGenerator:    getPanelIdentityKey,
  handler:         makeHandler('Sesión inválida, por favor iniciá sesión nuevamente'),
});

// ── uploadLimiter ─────────────────────────────────────────────────────────────
// Subida de archivos — costoso en storage, límite bajo.
// Key por userId — un usuario no debería subir más de 20 fotos en 15 min.
export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  keyGenerator:    getPanelIdentityKey,
  handler:         makeHandler('Demasiadas subidas de archivos, esperá unos minutos'),
});

// ── slotLimiter ───────────────────────────────────────────────────────────────
// GET /public/:slug/slots — consulta de disponibilidad desde el formulario público.
// Key por IP — ruta pública, sin userId.
export const slotLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        2 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  handler:         makeHandler('Demasiadas consultas de disponibilidad, esperá unos segundos'),
});

// ── bookingLimiter ────────────────────────────────────────────────────────────
// POST /public/:slug — creación de reservas públicas.
// Key por IP — ruta pública, sin userId.
export const bookingLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  handler:         makeHandler('Demasiadas reservas en poco tiempo, esperá unos minutos'),
});

// ── publicLimiter ─────────────────────────────────────────────────────────────
// GET /public/:slug y /slug-check — rutas públicas con caché.
// Key por IP — sin userId disponible.
export const publicLimiter: RateLimitRequestHandler = rateLimit({
  windowMs:        1 * 60 * 1000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => isRateLimitDisabled,
  handler:         makeHandler('Demasiadas solicitudes'),
});