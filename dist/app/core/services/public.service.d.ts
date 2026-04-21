import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Barber } from '../../domain/models/barber.model';
import { Service, ServiceDefault } from '../../domain/models/service.model';
export interface PublicBusiness {
    id: string;
    slug: string;
    nombre: string;
    logo_url: string | null;
    color_fondo: string;
    color_acento: string;
    color_superficie: string;
    whatsapp: string | null;
    direccion: string | null;
    email: string | null;
    frase_bienvenida: string | null;
    hero_imagen_url: string | null;
    instagram: string | null;
    facebook: string | null;
    tipografia: string;
    estilo_cards: string;
    termino_profesional: string;
    termino_profesional_plural: string;
    termino_servicio: string;
    termino_reserva: string;
    status: 'active' | 'trial' | 'trial_expired' | 'paused';
}
export interface TimeSlot {
    hora_inicio: string;
    hora_fin: string;
    disponible: boolean;
}
export interface PublicBusinessData {
    business: PublicBusiness;
    barbers: Barber[];
    services: Service[];
}
export interface CreateBookingRequest {
    barber_id: string;
    service_id: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    cliente_nombre: string;
    cliente_email: string;
    cliente_telefono: string;
}
export interface CreateBookingResponse {
    id: string;
    fecha: string;
    hora_inicio: string;
    cliente_nombre: string;
    estado: string;
}
export declare class PublicService {
    private readonly http;
    private readonly api;
    private readonly CACHE_TTL;
    private readonly cache;
    constructor(http: HttpClient);
    getBusiness(slug: string): Observable<PublicBusinessData>;
    invalidateCache(slug: string): void;
    getSlots(slug: string, barberId: string, fecha: string, serviceId: string): Observable<{
        slots: TimeSlot[];
        fecha: string;
        barber_id: string;
    }>;
    createBooking(slug: string, data: CreateBookingRequest): Observable<CreateBookingResponse>;
    getAvailableDays(slug: string, barberId: string, year: number, month: number, serviceId: string): Observable<{
        availableDays: string[];
    }>;
    cancelBooking(token: string): Observable<void>;
    getBusinessByDomain(domain: string): Observable<PublicBusinessData>;
    listDefaults(tipoNegocio?: string): Observable<ServiceDefault[]>;
}
//# sourceMappingURL=public.service.d.ts.map