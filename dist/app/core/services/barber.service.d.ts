import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Barber } from '../../domain/models/barber.model';
interface CreateBarberRequest {
    nombre: string;
    descripcion?: string;
    orden?: number;
    activo?: boolean;
}
interface UpdateBarberRequest {
    nombre?: string;
    descripcion?: string;
    foto_url?: string;
    orden?: number;
    activo?: boolean;
}
export declare class BarberService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    list(): Observable<Barber[]>;
    create(data: CreateBarberRequest): Observable<Barber>;
    update(id: string, data: UpdateBarberRequest): Observable<Barber>;
    delete(id: string): Observable<void>;
}
export {};
//# sourceMappingURL=barber.service.d.ts.map