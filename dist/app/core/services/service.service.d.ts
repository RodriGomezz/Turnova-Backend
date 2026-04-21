import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Service, ServiceDefault } from '../../domain/models/service.model';
interface CreateServiceRequest {
    nombre: string;
    duracion_minutos: number;
    precio: number;
    descripcion?: string;
    activo?: boolean;
}
interface UpdateServiceRequest {
    nombre?: string;
    duracion_minutos?: number;
    precio?: number;
    descripcion?: string;
    activo?: boolean;
}
export declare class ServiceService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    list(): Observable<Service[]>;
    listDefaults(tipoNegocio?: string): Observable<ServiceDefault[]>;
    create(data: CreateServiceRequest): Observable<Service>;
    update(id: string, data: UpdateServiceRequest): Observable<Service>;
    delete(id: string): Observable<void>;
}
export {};
//# sourceMappingURL=service.service.d.ts.map