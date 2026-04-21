import { Observable } from 'rxjs';
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
    periodo: {
        year: number;
        month: number;
        from: string;
        to: string;
    };
    resumen: StatsResumen;
    topProfesionalId: string | null;
    topServicio: {
        nombre: string;
        count: number;
    } | null;
    horaPico: string | null;
    distribucionHoras: HoraStat[];
    porDia: DayStat[];
}
export declare class StatsService {
    private readonly api;
    private readonly http;
    get(year: number, month: number): Observable<StatsData>;
}
//# sourceMappingURL=stats.service.d.ts.map