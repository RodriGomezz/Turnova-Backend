import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { UserRepository }    from "../../infrastructure/database/UserRepository";
import { UnauthorizedError } from "../../domain/errors";
import { logger }            from "../../infrastructure/logger";

declare global {
  namespace Express {
    interface Request {
      userId?:     string;
      businessId?: string;
    }
  }
}

// ── JWKS remoto — se cachea automáticamente por `jose` ───────────────────
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

// ── Cache de businessId ───────────────────────────────────────────────────

interface CacheEntry {
  businessId: string;
  timestamp:  number;
}

const USER_CACHE_TTL_MS   = 5 * 60 * 1_000;
const USER_CACHE_MAX_SIZE = 1_000;
const userCache = new Map<string, CacheEntry>();

function getCached(userId: string): string | null {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > USER_CACHE_TTL_MS) {
    userCache.delete(userId);
    return null;
  }
  return entry.businessId;
}

function setCache(userId: string, businessId: string): void {
  if (userCache.size >= USER_CACHE_MAX_SIZE) {
    const firstKey = userCache.keys().next().value;
    if (firstKey !== undefined) userCache.delete(firstKey);
  }
  userCache.set(userId, { businessId, timestamp: Date.now() });
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

const userRepository = new UserRepository();

// ── Middleware ────────────────────────────────────────────────────────────

export const authMiddleware = async (
  req:  Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = req.query["token"] as string | undefined;

    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (queryToken && req.path.endsWith("/confirm-stream")) {
      token = queryToken;
    }

    if (!token) throw new UnauthorizedError();

    // ── Verificación local ES256 — sin llamada a Supabase por request ────
    let payload: { sub?: string };
    try {
      const result = await jwtVerify(token, JWKS, { algorithms: ["ES256"] });
      payload = result.payload;
    } catch (err) {
      logger.debug("JWT inválido o expirado", { err });
      throw new UnauthorizedError();
    }

    const userId = payload.sub;
    if (!userId) throw new UnauthorizedError();

    // ── Cache ─────────────────────────────────────────────────────────────
    const cached = getCached(userId);
    if (cached) {
      req.userId     = userId;
      req.businessId = cached;
      return next();
    }

    const dbUser = await userRepository.findById(userId);
    if (!dbUser) throw new UnauthorizedError();

    setCache(userId, dbUser.business_id);
    req.userId     = userId;
    req.businessId = dbUser.business_id;

    next();
  } catch (error) {
    next(error);
  }
};