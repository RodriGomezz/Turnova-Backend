import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    barbers?: {
        nombre: string;
    } | null;
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
export declare class ScheduleService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    listSchedules(): Observable<Schedule[]>;
    createSchedule(data: CreateScheduleRequest): Observable<Schedule>;
    updateSchedule(id: string, data: UpdateScheduleRequest): Observable<Schedule>;
    deleteSchedule(id: string): Observable<void>;
    listBlockedDates(): Observable<BlockedDate[]>;
    createBlockedDate(data: CreateBlockedDateRequest): Observable<BlockedDate>;
    deleteBlockedDate(id: string): Observable<void>;
}
export {};
//# sourceMappingURL=schedule.service.d.ts.map