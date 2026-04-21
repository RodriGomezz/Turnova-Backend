export declare class SubdomainService {
    private readonly baseDomain;
    getSlug(): string | null;
    isSubdomain(): boolean;
    isCustomDomain(): boolean;
    buildRouterLink(slug: string, ...segments: string[]): string[];
    buildPublicUrl(slug: string, path?: string): string;
}
//# sourceMappingURL=subdomain.service.d.ts.map