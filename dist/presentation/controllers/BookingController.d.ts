import { Request, Response, NextFunction } from "express";
import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { GetAvailableSlotsUseCase } from "../../application/bookings/GetAvailableSlotsUseCase";
import { CreateBookingUseCase } from "../../application/bookings/CreateBookingUseCase";
import { GetDaySummaryUseCase } from "../../application/bookings/GetDaySummaryUseCase";
import { GetAvailableDaysUseCase } from "../../application/bookings/GetAvailableDaysUseCase";
import { IEmailService } from "../../application/ports/IEmailService";
export declare class BookingController {
    private readonly bookingRepository;
    private readonly barberRepository;
    private readonly serviceRepository;
    private readonly businessRepository;
    private readonly getAvailableSlotsUseCase;
    private readonly createBookingUseCase;
    private readonly getDaySummaryUseCase;
    private readonly getAvailableDaysUseCase;
    private readonly emailService;
    constructor(bookingRepository: IBookingRepository, barberRepository: IBarberRepository, serviceRepository: IServiceRepository, businessRepository: IBusinessRepository, getAvailableSlotsUseCase: GetAvailableSlotsUseCase, createBookingUseCase: CreateBookingUseCase, getDaySummaryUseCase: GetDaySummaryUseCase, getAvailableDaysUseCase: GetAvailableDaysUseCase, emailService: IEmailService);
    listByDate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateEstado: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getMonthSummary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getDaySummary: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getAvailableSlots: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getAvailableDays: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createPublic: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    cancelByToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private calcHoraFin;
    private checkMonthlyLimit;
    private sendEmailsAsync;
}
//# sourceMappingURL=BookingController.d.ts.map