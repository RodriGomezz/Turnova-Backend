"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
exports.invalidateUserCache = invalidateUserCache;
const supabase_client_1 = require("../../infrastructure/database/supabase.client");
const UserRepository_1 = require("../../infrastructure/database/UserRepository");
const errors_1 = require("../../domain/errors");
const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const USER_CACHE_MAX_SIZE = 1000;
const userRepository = new UserRepository_1.UserRepository();
const userCache = new Map();
function getCached(userId) {
    const entry = userCache.get(userId);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > USER_CACHE_TTL_MS) {
        userCache.delete(userId);
        return null;
    }
    return entry.businessId;
}
function setCache(userId, businessId) {
    if (userCache.size >= USER_CACHE_MAX_SIZE) {
        const firstKey = userCache.keys().next().value;
        if (firstKey !== undefined)
            userCache.delete(firstKey);
    }
    userCache.set(userId, { businessId, timestamp: Date.now() });
}
function invalidateUserCache(userId) {
    userCache.delete(userId);
}
const authMiddleware = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer "))
            throw new errors_1.UnauthorizedError();
        const token = authHeader.slice(7); // más eficiente que split(" ")[1]
        const { data: { user }, error, } = await supabase_client_1.supabase.auth.getUser(token);
        if (error || !user)
            throw new errors_1.UnauthorizedError();
        const cached = getCached(user.id);
        if (cached) {
            req.userId = user.id;
            req.businessId = cached;
            return next();
        }
        const dbUser = await userRepository.findById(user.id);
        if (!dbUser)
            throw new errors_1.UnauthorizedError();
        setCache(user.id, dbUser.business_id);
        req.userId = user.id;
        req.businessId = dbUser.business_id;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map