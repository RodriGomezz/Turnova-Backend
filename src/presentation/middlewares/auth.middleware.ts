import { Request, Response, NextFunction } from "express";
import { supabase } from "../../infrastructure/database/supabase.client";
import { UserRepository } from "../../infrastructure/database/UserRepository";
import { UnauthorizedError } from "./errorHandler.middleware";

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

const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const USER_CACHE_MAX = 1000; // máximo de entradas — previene memory leak
const userRepository = new UserRepository();
const userCache = new Map<string, CacheEntry>();

function getCached(userId: string): string | null {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > USER_CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return entry.businessId;
}

function setCache(userId: string, businessId: string): void {
  // Evitar crecimiento ilimitado — eliminar la entrada más antigua si se supera el límite
  if (userCache.size >= USER_CACHE_MAX) {
    const firstKey = userCache.keys().next().value;
    if (firstKey) userCache.delete(firstKey);
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

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) throw new UnauthorizedError();

    const userId = user.id;

    const cachedBusinessId = getCached(userId);
    if (cachedBusinessId) {
      req.userId = userId;
      req.businessId = cachedBusinessId;
      return next();
    }

    const dbUser = await userRepository.findById(userId);
    if (!dbUser) throw new UnauthorizedError();

    setCache(userId, dbUser.business_id);

    req.userId = userId;
    req.businessId = dbUser.business_id;
    next();
  } catch (error) {
    next(error);
  }
};
