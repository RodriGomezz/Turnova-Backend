import { Observable } from 'rxjs';
export interface DomainStatus {
    custom_domain: string | null;
    domain_verified: boolean;
    domain_verified_at: string | null;
    domain_added_at: string | null;
}
export interface DomainCheckResult {
    verified: boolean;
    configured: boolean;
    domain: string;
}
export interface DnsInstructions {
    type: string;
    name: string;
    value: string;
    note: string;
}
export interface AddDomainResponse {
    message: string;
    custom_domain: string;
    dns_instructions: DnsInstructions;
}
export declare class DomainService {
    private readonly api;
    private readonly http;
    get(): Observable<DomainStatus>;
    add(domain: string): Observable<AddDomainResponse>;
    remove(): Observable<void>;
    checkStatus(): Observable<DomainCheckResult>;
}
//# sourceMappingURL=domain.service.d.ts.map