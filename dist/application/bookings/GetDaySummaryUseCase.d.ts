import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
export interface BarberDaySummary {
    id: string;
    nombre: string;
    foto_url: string | null;
    trabajaHoy: boolean;
    turnos: number;
    ingreso: number;
}
export interface DaySummaryResult {
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
    barbers: BarberDaySummary[];
}
export declare class GetDaySummaryUseCase {
    private readonly bookingRepository;
    private readonly scheduleRepository;
    private readonly blockedDateRepository;
    private readonly barberRepository;
    private readonly businessRepository;
    private static readonly SLOT_SIZE_MINUTES;
    constructor(bookingRepository: IBookingRepository, scheduleRepository: IScheduleRepository, blockedDateRepository: IBlockedDateRepository, barberRepository: IBarberRepository, businessRepository: IBusinessRepository);
    execute(businessId: string, fecha: string): Promise<DaySummaryResult>;
    private parseDiaSemana;
    private parseMinutes;
    private minutesToTime;
    private findScheduleForBarber;
    private isBarberBlocked;
    private calcularOcupacion;
    private calcularPrimerTurnoLibre;
    private calcularClientesNuevos;
    private buildBarberSummaries;
}
//# sourceMappingURL=GetDaySummaryUseCase.d.ts.map