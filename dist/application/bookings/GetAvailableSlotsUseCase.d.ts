import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
export interface GetAvailableSlotsInput {
    barberId: string;
    businessId: string;
    fecha: string;
    duracionMinutos: number;
    bufferMinutos: number;
}
export interface TimeSlot {
    hora_inicio: string;
    hora_fin: string;
    disponible: boolean;
}
export declare class GetAvailableSlotsUseCase {
    private readonly bookingRepository;
    private readonly scheduleRepository;
    private readonly blockedDateRepository;
    constructor(bookingRepository: IBookingRepository, scheduleRepository: IScheduleRepository, blockedDateRepository: IBlockedDateRepository);
    execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]>;
    /**
     * Parsea la fecha como fecha local para evitar bugs de timezone.
     * "2025-01-15" → Date(2025, 0, 15) → .getDay()
     */
    private parseDiaSemana;
    private normalizeTime;
    private generateSlots;
    private isSlotTaken;
    private timeToMinutes;
    private minutesToTime;
}
//# sourceMappingURL=GetAvailableSlotsUseCase.d.ts.map