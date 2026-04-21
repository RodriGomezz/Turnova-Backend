interface VercelDomainVerification {
    type: string;
    domain: string;
    value: string;
    reason: string;
}
export interface VercelAddDomainResponse {
    name: string;
    verified: boolean;
    configured: boolean;
    verification?: VercelDomainVerification[];
    error?: {
        code: string;
        message: string;
    };
}
export interface VercelCheckDomainResponse {
    name: string;
    verified: boolean;
    configured: boolean;
}
export declare const vercelClient: {
    addDomain(domain: string): Promise<VercelAddDomainResponse>;
    removeDomain(domain: string): Promise<void>;
    checkDomain(domain: string): Promise<VercelCheckDomainResponse>;
};
export {};
//# sourceMappingURL=vercel.client.d.ts.map