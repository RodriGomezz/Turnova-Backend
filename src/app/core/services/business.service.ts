// business.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<Business> {
    return this.http
      .get<{ business: Business }>(`${this.api}/business`)
      .pipe(map((res) => res.business));
  }

  update(data: UpdateBusinessRequest): Observable<Business> {
    return this.http
      .put<{ business: Business }>(`${this.api}/business`, data)
      .pipe(map((res) => res.business));
  }

  getStatus(): Observable<BusinessStatus> {
    return this.http.get<BusinessStatus>(`${this.api}/business/status`);
  }

  completeOnboarding(): Observable<void> {
    return this.http.patch<void>(`${this.api}/business/onboarding`, {});
  }

  switchBusiness(businessId: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/business/switch`, {
      business_id: businessId,
    });
  }

  listUserBusinesses(): Observable<BusinessBranch[]> {
     return this.http
    .get<{ businesses: BusinessBranch[] }>(`${this.api}/business/all`, {
      headers: { 'Cache-Control': 'no-cache' },
    })
    .pipe(map((res) => res.businesses));
}

  deactivateBranch(id: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/business/${id}/deactivate`, {});
  }

  reactivateBranch(id: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/business/${id}/reactivate`, {});
  }

  deleteBranch(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/business/${id}`);
  }
}
