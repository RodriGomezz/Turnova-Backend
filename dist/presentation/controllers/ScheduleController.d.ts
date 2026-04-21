import { Request, Response, NextFunction } from "express";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
export declare class ScheduleController {
    private readonly scheduleRepository;
    private readonly blockedDateRepository;
    constructor(scheduleRepository: IScheduleRepository, blockedDateRepository: IBlockedDateRepository);
    listSchedules: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createSchedule: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    updateSchedule: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteSchedule: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listBlockedDates: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createBlockedDate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteBlockedDate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=ScheduleController.d.ts.map