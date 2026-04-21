interface PublicBusinessData {
    business: Record<string, unknown>;
    barbers: unknown[];
    services: unknown[];
}
export declare const PUBLIC_CACHE_TTL: number;
export declare function getCached(slug: string): PublicBusinessData | null;
export declare function setCache(slug: string, businessId: string, data: PublicBusinessData): void;
export declare function invalidateByBusinessId(businessId: string): void;
export declare function invalidateBySlug(slug: string): void;
export {};
//# sourceMappingURL=public.cache.d.ts.map