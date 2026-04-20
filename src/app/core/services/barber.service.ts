// barber.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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

@Injectable({ providedIn: 'root' })
export class BarberService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Barber[]> {
    return this.http
      .get<{ barbers: Barber[] }>(`${this.api}/barbers`)
      .pipe(map((res) => res.barbers));
  }

  create(data: CreateBarberRequest): Observable<Barber> {
    return this.http
      .post<{ barber: Barber }>(`${this.api}/barbers`, data)
      .pipe(map((res) => res.barber));
  }

  update(id: string, data: UpdateBarberRequest): Observable<Barber> {
    return this.http
      .put<{ barber: Barber }>(`${this.api}/barbers/${id}`, data)
      .pipe(map((res) => res.barber));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/barbers/${id}`);
  }
}
