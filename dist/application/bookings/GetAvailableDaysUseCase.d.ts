import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
export interface GetAvailableDaysInput {
    slug: string;
    year: number;
    month: number;
    barberId: string;
    serviceId?: string;
}
export interface GetAvailableDaysResult {
    availableDays: string[];
    year: number;
    month: number;
}
export declare class GetAvailableDaysUseCase {
    private readonly businessRepository;
    private readonly serviceRepository;
    private readonly scheduleRepository;
    private readonly blockedDateRepository;
    private readonly bookingRepository;
    /** Días máximos hacia adelante que se permiten reservar */
    private static readonly MAX_DAYS_AHEAD;
    constructor(businessRepository: IBusinessRepository, serviceRepository: IServiceRepository, scheduleRepository: IScheduleRepository, blockedDateRepository: IBlockedDateRepository, bookingRepository: IBookingRepository);
    execute(input: GetAvailableDaysInput): Promise<GetAvailableDaysResult>;
    private isDateBlocked;
    private hasAvailableSlot;
    private parseMinutes;
    private minutesToTime;
}
//# sourceMappingURL=GetAvailableDaysUseCase.d.ts.map