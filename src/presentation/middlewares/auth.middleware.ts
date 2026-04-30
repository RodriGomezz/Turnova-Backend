import { Request, Response, NextFunction } from "express";
import {
  createSupabaseAuthClient,
} from "../../infrastructure/database/supabase.client";
import { UserRepository } from "../../infrastructure/database/UserRepository";
import { UnauthorizedError } from "../../domain/errors";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      businessId?: string;
    }
  }
}

interface CacheEntry {
  businessId: string;
  timestamp: number;
}

const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const USER_CACHE_MAX_SIZE = 1_000;

const userRepository = new UserRepository();
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

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedError();

    const token = authHeader.slice(7); // más eficiente que split(" ")[1]

    const authClient = createSupabaseAuthClient();

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(token);

    if (error || !user) throw new UnauthorizedError();

    const cached = getCached(user.id);
    if (cached) {
      req.userId = user.id;
      req.businessId = cached;
      return next();
    }

    const dbUser = await userRepository.findById(user.id);
    if (!dbUser) throw new UnauthorizedError();

    setCache(user.id, dbUser.business_id);
    req.userId = user.id;
    req.businessId = dbUser.business_id;
    next();
  } catch (error) {
    next(error);
  }
};
