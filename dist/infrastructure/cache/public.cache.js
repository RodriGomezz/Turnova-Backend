"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_CACHE_TTL = void 0;
exports.getCached = getCached;
exports.setCache = setCache;
exports.invalidateByBusinessId = invalidateByBusinessId;
exports.invalidateBySlug = invalidateBySlug;
exports.PUBLIC_CACHE_TTL = 2 * 60 * 1000;
// Cache por slug — clave de acceso en requests públicos
const publicCache = new Map();
// Índice inverso businessId → slug — para invalidar sin query a la BD
const businessIdToSlug = new Map();
function getCached(slug) {
    const entry = publicCache.get(slug);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > exports.PUBLIC_CACHE_TTL) {
        publicCache.delete(slug);
        businessIdToSlug.delete(entry.businessId);
        return null;
    }
    return entry.data;
}
function setCache(slug, businessId, data) {
    publicCache.set(slug, { data, timestamp: Date.now(), businessId });
    businessIdToSlug.set(businessId, slug);
}
function invalidateByBusinessId(businessId) {
    const slug = businessIdToSlug.get(businessId);
    if (!slug)
        return;
    publicCache.delete(slug);
    businessIdToSlug.delete(businessId);
}
function invalidateBySlug(slug) {
    const entry = publicCache.get(slug);
    if (!entry)
        return;
    businessIdToSlug.delete(entry.businessId);
    publicCache.delete(slug);
}
//# sourceMappingURL=public.cache.js.map