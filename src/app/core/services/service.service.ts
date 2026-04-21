import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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

@Injectable({ providedIn: 'root' })
export class ServiceService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Service[]> {
    return this.http
      .get<{ services: Service[] }>(`${this.api}/services`)
      .pipe(map((res) => res.services));
  }

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

  create(data: CreateServiceRequest): Observable<Service> {
    return this.http
      .post<{ service: Service }>(`${this.api}/services`, data)
      .pipe(map((res) => res.service));
  }

  update(id: string, data: UpdateServiceRequest): Observable<Service> {
    return this.http
      .put<{ service: Service }>(`${this.api}/services/${id}`, data)
      .pipe(map((res) => res.service));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/services/${id}`);
  }
}
