import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
export declare class BookingService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    getByDate(fecha: string): Observable<Booking[]>;
    updateEstado(id: string, estado: BookingEstado): Observable<Booking>;
    getMonthSummary(year: number, month: number): Observable<{
        summary: MonthDayStat[];
    }>;
    getDaySummary(fecha: string): Observable<DaySummary>;
}
//# sourceMappingURL=booking.service.d.ts.map