import { Request, Response, NextFunction } from 'express';
import { ScheduleRepository } from '../../infrastructure/database/ScheduleRepository';
import { BlockedDateRepository } from '../../infrastructure/database/BlockedDateRepository';
import { NotFoundError, ForbiddenError } from '../middlewares/errorHandler.middleware';
import {
  CreateScheduleInput,
  UpdateScheduleInput,
  CreateBlockedDateInput,
} from '../schemas/schedule.schema';

export class ScheduleController {
  private scheduleRepository: ScheduleRepository;
  private blockedDateRepository: BlockedDateRepository;

  constructor() {
    this.scheduleRepository = new ScheduleRepository();
    this.blockedDateRepository = new BlockedDateRepository();
  }

  // ── Horarios ──────────────────────────────────────────────────

  listSchedules = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const schedules = await this.scheduleRepository.findByBusiness(
        req.businessId!,
      );
      res.json({ schedules });
    } catch (error) {
      next(error);
    }
  };

  createSchedule = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = req.body as CreateScheduleInput;
      const schedule = await this.scheduleRepository.create({
        ...input,
        dia_semana: input.dia_semana as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        business_id: req.businessId!,
      });
      res.status(201).json({ schedule });
    } catch (error) {
      next(error);
    }
  };
    updateSchedule = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const input = req.body as UpdateScheduleInput;

      const existing = await this.scheduleRepository.findById(id);
      if (!existing) throw new NotFoundError("Horario");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const schedule = await this.scheduleRepository.update(id, input);
      res.json({ schedule });
    } catch (error) {
      next(error);
    }
  };

  deleteSchedule = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.scheduleRepository.findById(id);
      if (!existing) throw new NotFoundError("Horario");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.scheduleRepository.delete(id);
      res.json({ message: "Horario eliminado correctamente" });
    } catch (error) {
      next(error);
    }
  };


  // ── Fechas bloqueadas ─────────────────────────────────────────

  listBlockedDates = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const blockedDates = await this.blockedDateRepository.findByBusiness(
        req.businessId!,
      );
      res.json({ blockedDates });
    } catch (error) {
      next(error);
    }
  };

  createBlockedDate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = req.body as CreateBlockedDateInput;
      const blockedDate = await this.blockedDateRepository.create({
        ...input,
        business_id: req.businessId!,
      });
      res.status(201).json({ blockedDate });
    } catch (error) {
      next(error);
    }
  };

  deleteBlockedDate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const blockedDates = await this.blockedDateRepository.findByBusiness(
        req.businessId!,
      );
      const existing = blockedDates.find((b) => b.id === id);
      if (!existing) throw new NotFoundError("Fecha bloqueada");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.blockedDateRepository.delete(id);
      res.json({ message: "Fecha desbloqueada correctamente" });
    } catch (error) {
      next(error);
    }
  };

}