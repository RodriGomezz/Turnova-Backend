import { Request, Response, NextFunction } from "express";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { NotFoundError, ForbiddenError, ValidationError } from "../../domain/errors";
import { invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";
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
      const includeAll = req.query["include_all"] === "true";
      const schedules = includeAll
        ? await this.scheduleRepository.findRawByBusiness(req.businessId!)
        : await this.scheduleRepository.findAllByBusiness(req.businessId!);
      res.json({ schedules });
    } catch (error) {
      next(error);
    }
  };

// ScheduleController.ts — reemplazar createSchedule y updateSchedule

createSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = req.body as CreateScheduleInput;

    // Validar contra horario del negocio solo si es horario de barbero
    if (input.barber_id) {
      await this.validateAgainstBusinessSchedule(
        req.businessId!,
        input.dia_semana as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        input.hora_inicio,
        input.hora_fin,
      );
    }

    const schedule = await this.scheduleRepository.create({
      dia_semana:  input.dia_semana as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      hora_inicio: input.hora_inicio,
      hora_fin:    input.hora_fin,
      barber_id:   input.barber_id ?? null,
      business_id: req.businessId!,
      activo:      true,
    });

    invalidateSlotsCache(req.businessId!);
    res.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
};

updateSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id    = req.params['id'] as string;
    const input = req.body as UpdateScheduleInput;

    const existing = await this.scheduleRepository.findById(id);
    if (!existing)                               throw new NotFoundError('Horario');
    if (existing.business_id !== req.businessId) throw new ForbiddenError();

    // Validar contra horario del negocio si es horario de barbero
    // y se están modificando las horas
    if (existing.barber_id && (input.hora_inicio || input.hora_fin)) {
      const horaInicio = input.hora_inicio ?? existing.hora_inicio.slice(0, 5);
      const horaFin    = input.hora_fin    ?? existing.hora_fin.slice(0, 5);
      await this.validateAgainstBusinessSchedule(
        req.businessId!,
        existing.dia_semana as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        horaInicio,
        horaFin,
      );
    }

    const schedule = await this.scheduleRepository.update(id, input);
    invalidateSlotsCache(req.businessId!);
    res.json({ schedule });
  } catch (error) {
    next(error);
  }
};

// ── Helper privado ────────────────────────────────────────────────────────

private async validateAgainstBusinessSchedule(
  businessId: string,
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  horaInicio: string,
  horaFin: string,
): Promise<void> {
  // Obtener el horario del negocio para este día
  const allSchedules = await this.scheduleRepository.findRawByBusiness(businessId);
  const bizSchedule  = allSchedules.find(
    s => s.barber_id === null && s.dia_semana === diaSemana && s.activo
  );

  if (!bizSchedule) {
    throw new ValidationError(
      `El negocio no trabaja ese día (día ${diaSemana})`
    );
  }

  const bizInicio = bizSchedule.hora_inicio.slice(0, 5);
  const bizFin    = bizSchedule.hora_fin.slice(0, 5);

  if (horaInicio < bizInicio || horaFin > bizFin) {
    throw new ValidationError(
      `El horario del profesional (${horaInicio}–${horaFin}) debe estar dentro del horario del negocio (${bizInicio}–${bizFin})`
    );
  }
}

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
      invalidateSlotsCache(req.businessId!);
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

      invalidateSlotsCache(req.businessId!);
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
      invalidateSlotsCache(req.businessId!);
      res.json({ message: "Fecha desbloqueada correctamente" });
    } catch (error) {
      next(error);
    }
  };
}
