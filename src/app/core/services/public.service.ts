// public.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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

interface CacheEntry {
  data: PublicBusinessData;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class PublicService {
  private readonly api = environment.apiUrl;
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly http: HttpClient) {}

  getBusiness(slug: string): Observable<PublicBusinessData> {
    const cached = this.cache.get(slug);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return of(cached.data);
    }

    return this.http
      .get<PublicBusinessData>(`${this.api}/bookings/public/${slug}`)
      .pipe(
        tap((data) => this.cache.set(slug, { data, timestamp: Date.now() })),
      );
  }

  invalidateCache(slug: string): void {
    this.cache.delete(slug);
  }

  getSlots(
    slug: string,
    barberId: string,
    fecha: string,
    serviceId: string,
  ): Observable<{ slots: TimeSlot[]; fecha: string; barber_id: string }> {
    const params = new HttpParams()
      .set('barber_id', barberId)
      .set('fecha', fecha)
      .set('service_id', serviceId);

    return this.http.get<{
      slots: TimeSlot[];
      fecha: string;
      barber_id: string;
    }>(`${this.api}/bookings/public/${slug}/slots`, { params });
  }

  createBooking(
    slug: string,
    data: CreateBookingRequest,
  ): Observable<CreateBookingResponse> {
    return this.http.post<CreateBookingResponse>(
      `${this.api}/bookings/public/${slug}`,
      data,
    );
  }

  getAvailableDays(
    slug: string,
    barberId: string,
    year: number,
    month: number,
    serviceId: string,
  ): Observable<{ availableDays: string[] }> {
    const params = new HttpParams()
      .set('barber_id', barberId)
      .set('year', year)
      .set('month', month)
      .set('service_id', serviceId);

    return this.http.get<{ availableDays: string[] }>(
      `${this.api}/bookings/public/${slug}/available-days`,
      { params },
    );
  }

  cancelBooking(token: string): Observable<void> {
    return this.http.patch<void>(
      `${this.api}/bookings/public/cancel/${token}`,
      {},
    );
  }

  getBusinessByDomain(domain: string): Observable<PublicBusinessData> {
    return this.http.get<PublicBusinessData>(
      `${this.api}/bookings/public/domain/${domain}`,
    );
  }

  // public.service.ts — actualizar la firma
  listDefaults(tipoNegocio?: string): Observable<ServiceDefault[]> {
    const params = tipoNegocio
      ? new HttpParams().set('tipo_negocio', tipoNegocio)
      : undefined;
    return this.http
      .get<{
        defaults: ServiceDefault[];
      }>(`${this.api}/services/defaults`, { params })
      .pipe(map((res) => res.defaults));
  }
}
