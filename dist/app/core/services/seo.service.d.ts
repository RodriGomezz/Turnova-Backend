type SeoConfig = {
    title: string;
    description: string;
    path?: string;
    image?: string;
};
export declare class SeoService {
    private readonly document;
    private readonly title;
    private readonly meta;
    setPageMeta(config: SeoConfig): void;
    private buildUrl;
    private updateCanonical;
}
export {};
//# sourceMappingURL=seo.service.d.ts.map