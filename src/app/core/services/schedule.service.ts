// schedule.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Schedule {
  id: string;
  business_id: string;
  barber_id: string | null;
  dia_semana: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

export interface BlockedDate {
  id: string;
  business_id: string;
  barber_id: string | null;
  fecha: string;
  fecha_fin: string;
  motivo: string | null;
  barbers?: { nombre: string } | null;
}

interface CreateScheduleRequest {
  barber_id?: string | null;
  dia_semana: Schedule['dia_semana'];
  hora_inicio: string;
  hora_fin: string;
  activo?: boolean;
}

interface UpdateScheduleRequest {
  hora_inicio?: string;
  hora_fin?: string;
  activo?: boolean;
}

interface CreateBlockedDateRequest {
  barber_id?: string | null;
  fecha: string;
  fecha_fin: string;
  motivo?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listSchedules(): Observable<Schedule[]> {
    return this.http
      .get<{ schedules: Schedule[] }>(`${this.api}/schedules`)
      .pipe(map((res) => res.schedules));
  }

  createSchedule(data: CreateScheduleRequest): Observable<Schedule> {
    return this.http
      .post<{ schedule: Schedule }>(`${this.api}/schedules`, data)
      .pipe(map((res) => res.schedule));
  }

  updateSchedule(
    id: string,
    data: UpdateScheduleRequest,
  ): Observable<Schedule> {
    return this.http
      .put<{ schedule: Schedule }>(`${this.api}/schedules/${id}`, data)
      .pipe(map((res) => res.schedule));
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/schedules/${id}`);
  }

  listBlockedDates(): Observable<BlockedDate[]> {
    return this.http
      .get<{ blockedDates: BlockedDate[] }>(`${this.api}/schedules/blocked`)
      .pipe(map((res) => res.blockedDates));
  }

  createBlockedDate(data: CreateBlockedDateRequest): Observable<BlockedDate> {
    return this.http
      .post<{ blockedDate: BlockedDate }>(`${this.api}/schedules/blocked`, data)
      .pipe(map((res) => res.blockedDate));
  }

  deleteBlockedDate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/schedules/blocked/${id}`);
  }
}
