import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Business } from '../../domain/models/business.model';
import { BusinessBranch } from '../../domain/models/business.model';
interface UpdateBusinessRequest {
    nombre?: string;
    logo_url?: string | null;
    color_fondo?: string;
    color_acento?: string;
    color_superficie?: string;
    email?: string;
    whatsapp?: string;
    direccion?: string;
    timezone?: string;
    buffer_minutos?: number;
    auto_confirmar?: boolean;
    frase_bienvenida?: string;
    hero_imagen_url?: string | null;
    instagram?: string;
    facebook?: string;
    tipografia?: Business['tipografia'];
    estilo_cards?: Business['estilo_cards'];
    termino_profesional?: string;
    termino_profesional_plural?: string;
    termino_servicio?: string;
    termino_reserva?: string;
}
export interface BusinessStatus {
    plan: string;
    trialActivo: boolean;
    maxBarberos: number;
    totalBarberos: number;
    excedeLimit: boolean;
}
export declare class BusinessService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    get(): Observable<Business>;
    update(data: UpdateBusinessRequest): Observable<Business>;
    getStatus(): Observable<BusinessStatus>;
    completeOnboarding(): Observable<void>;
    switchBusiness(businessId: string): Observable<void>;
    listUserBusinesses(): Observable<BusinessBranch[]>;
    deactivateBranch(id: string): Observable<void>;
    reactivateBranch(id: string): Observable<void>;
    deleteBranch(id: string): Observable<void>;
}
export {};
//# sourceMappingURL=business.service.d.ts.map