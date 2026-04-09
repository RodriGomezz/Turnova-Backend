import { Request, Response, NextFunction } from "express";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { NotFoundError, ForbiddenError } from "../../domain/errors";
import {
  CreateScheduleInput,
  UpdateScheduleInput,
  CreateBlockedDateInput,
} from "../schemas/schedule.schema";

export class ScheduleController {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
  ) {}

  // ── Horarios ──────────────────────────────────────────────────────────────

  listSchedules = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const schedules = await this.scheduleRepository.findAllByBusiness(
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
        dia_semana: input.dia_semana as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        hora_inicio: input.hora_inicio,
        hora_fin: input.hora_fin,
        barber_id: input.barber_id ?? null,
        business_id: req.businessId!,
        activo: true,
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

  // ── Fechas bloqueadas ─────────────────────────────────────────────────────

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
        fecha: input.fecha,
        fecha_fin: input.fecha_fin ?? null,
        motivo: input.motivo ?? null,
        barber_id: input.barber_id ?? null,
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
