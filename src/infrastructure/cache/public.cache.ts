interface PublicBusinessData {
  business: Record<string, unknown>;
  barbers: unknown[];
  services: unknown[];
}

interface CacheEntry {
  data: PublicBusinessData;
  timestamp: number;
  businessId: string; // mapeo inverso para invalidar por businessId
}

export const PUBLIC_CACHE_TTL = 2 * 60 * 1000;

// Cache por slug — clave de acceso en requests públicos
const publicCache = new Map<string, CacheEntry>();

// Índice inverso businessId → slug — para invalidar sin query a la BD
const businessIdToSlug = new Map<string, string>();

export function getCached(slug: string): PublicBusinessData | null {
  const entry = publicCache.get(slug);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PUBLIC_CACHE_TTL) {
    publicCache.delete(slug);
    businessIdToSlug.delete(entry.businessId);
    return null;
  }
  return entry.data;
}

export function setCache(
  slug: string,
  businessId: string,
  data: PublicBusinessData,
): void {
  publicCache.set(slug, { data, timestamp: Date.now(), businessId });
  businessIdToSlug.set(businessId, slug);
}

export function invalidateByBusinessId(businessId: string): void {
  const slug = businessIdToSlug.get(businessId);
  if (!slug) return;
  publicCache.delete(slug);
  businessIdToSlug.delete(businessId);
}

export function invalidateBySlug(slug: string): void {
  const entry = publicCache.get(slug);
  if (!entry) return;
  businessIdToSlug.delete(entry.businessId);
  publicCache.delete(slug);
}
