import { Observable } from 'rxjs';
import { BusinessService } from './business.service';
export interface Terminology {
    profesional: string;
    profesionalPlural: string;
    servicio: string;
    reserva: string;
}
export declare class TerminologyService {
    private readonly businessService;
    private readonly _terms;
    readonly terms: any;
    readonly profesional: any;
    readonly profesionalPlural: any;
    readonly servicio: any;
    readonly reserva: any;
    constructor(businessService: BusinessService);
    load(): Observable<void>;
    update(terms: Terminology): void;
    clear(): void;
    private readCache;
    private writeCache;
}
//# sourceMappingURL=terminology.service.d.ts.map