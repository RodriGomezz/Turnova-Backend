// src/middleware/request-logger.middleware.ts
import { randomUUID }             from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger }                 from '../../infrastructure/logger';
import { requestContext }         from '../../infrastructure/request-context';

// Rutas excluidas del log (health checks, pings de uptime monitors, etc.)
const SKIP_PATHS = new Set(['/health', '/ping', '/metrics', '/favicon.ico']);

// Umbral para loggear requests lentos como warn (ms)
const SLOW_REQUEST_MS = 3_000;

// Campos sensibles a redactar del body antes de loggear
const SENSITIVE_BODY_KEYS = new Set([
  'password', 'token', 'refresh_token', 'access_token',
  'authorization', 'secret', 'api_key', 'cvv', 'card_number',
]);

// Extrae el sub (userId) del JWT sin verificar firma.
// Solo para logging — nunca usar para autenticar.
function extractUserIdFromToken(req: Request): string | undefined {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    const payload = header.slice(7).split('.')[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof decoded.sub === 'string' ? decoded.sub : undefined;
  } catch {
    return undefined;
  }
}

// Sanitiza el body antes de loguearlo — defensivo frente a bugs en el logger.
// No delegar al sanitize del logger: el body es controlado por el cliente
// y en un error 400 puede contener exactamente los campos que queremos redactar.
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    result[k] = SENSITIVE_BODY_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return result;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (SKIP_PATHS.has(req.path)) return next();

  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.requestId   = requestId;
  res.setHeader('x-request-id', requestId);

  // Priorizar userId ya verificado por authMiddleware si ya corrió.
  // Si no, intentar extraer del JWT solo para errores (donde necesitamos contexto).
  const userId     = (req as any).userId     as string | undefined;
  const businessId = (req as any).businessId as string | undefined;

  // Iniciar el AsyncLocalStorage con el contexto del request.
  // Esto hace que requestId (y userId una vez autenticado) estén disponibles
  // en servicios y repositorios sin pasar parámetros.
  requestContext.run({ requestId, userId, businessId }, () => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status   = res.statusCode;

      // Enriquecer el contexto con datos post-auth si ya están disponibles
      const finalUserId     = (req as any).userId     as string | undefined ?? userId;
      const finalBusinessId = (req as any).businessId as string | undefined ?? businessId;

      // Usar originalUrl para incluir query string (crítico para debugging de 400/422)
      const url = req.originalUrl ?? req.path;
      const msg = `${req.method} ${url} → ${status} (${duration}ms)`;

      const meta = {
        requestId,
        method:   req.method,
        path:     req.path,
        url,
        status,
        duration,
        ip: req.ip,
        ...(finalUserId     ? { userId: finalUserId }         : {}),
        ...(finalBusinessId ? { businessId: finalBusinessId } : {}),
        // Body sanitizado localmente — nunca delegar al sanitize del logger
        ...(status >= 400 && req.body && Object.keys(req.body ?? {}).length > 0
          ? { body: sanitizeBody(req.body) }
          : {}),
      };

      // Slow request detection — warn independiente del status
      if (duration >= SLOW_REQUEST_MS) {
        logger.warn(`SLOW ${msg}`, { ...meta, slowThresholdMs: SLOW_REQUEST_MS });
        return;
      }

      if (status >= 500)      logger.error(msg, meta);
      else if (status >= 400) logger.warn(msg, meta);
      else                    logger.http(msg, { requestId, duration });
    });

    next();
  });
};