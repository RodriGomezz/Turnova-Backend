// src/app/core/services/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StatsResumen {
  totalTurnos: number;
  turnosVariacion: number | null;
  cancelados: number;
  tasaCancelacion: number;
  ingresosMes: number;
  ingresosVariacion: number | null;
  clientesNuevos: number;
  clientesRecurrentes: number;
}

export interface DayStat {
  fecha: string;
  total: number;
}

export interface HoraStat {
  hora: string;
  count: number;
}

export interface StatsData {
  periodo: { year: number; month: number; from: string; to: string };
  resumen: StatsResumen;
  topProfesionalId: string | null;
  topServicio: { nombre: string; count: number } | null;
  horaPico: string | null;
  distribucionHoras: HoraStat[];
  porDia: DayStat[];
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly api = environment.apiUrl;
  private readonly http = inject(HttpClient);

  get(year: number, month: number): Observable<StatsData> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<StatsData>(`${this.api}/stats`, { params });
  }
}
