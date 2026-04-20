import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Booking, BookingEstado } from '../../domain/models/booking.model';

export interface DaySummaryBarber {
  id: string;
  nombre: string;
  foto_url: string | null;
  trabajaHoy: boolean;
  turnos: number;
  ingreso: number;
}

export interface DaySummary {
  fecha: string;
  resumen: {
    totalTurnos: number;
    cancelados: number;
    pendientes: number;
    confirmados: number;
    ingresoDia: number;
    ocupacionPct: number;
    primerTurnoLibre: string | null;
    clientesNuevosHoy: number;
    esDiaNoLaborable: boolean;
  };
  barbers: DaySummaryBarber[];
}

export interface MonthDayStat {
  fecha: string;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getByDate(fecha: string): Observable<Booking[]> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http
      .get<{
        bookings: Booking[];
        fecha: string;
      }>(`${this.api}/bookings/panel`, { params })
      .pipe(map((res) => res.bookings));
  }

  updateEstado(id: string, estado: BookingEstado): Observable<Booking> {
    return this.http
      .patch<{
        booking: Booking;
      }>(`${this.api}/bookings/panel/${id}/estado`, { estado })
      .pipe(map((res) => res.booking));
  }

  getMonthSummary(
    year: number,
    month: number,
  ): Observable<{ summary: MonthDayStat[] }> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<{ summary: MonthDayStat[] }>(
      `${this.api}/bookings/panel/month`,
      { params },
    );
  }

  getDaySummary(fecha: string): Observable<DaySummary> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<DaySummary>(`${this.api}/bookings/panel/day-summary`, {
      params,
    });
  }
}
