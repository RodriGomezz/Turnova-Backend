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
import {
  NotFoundError,
  ForbiddenError,
  AppError,
  ValidationError,
} from "../../domain/errors";
import { CreateBookingInput } from "../schemas/booking.schema";
import { getPlanLimits } from "../../domain/plan-limits";
import { getBusinessStatus } from "../../domain/business-status";
import { logger } from "../../infrastructure/logger";

export class BookingController {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly barberRepository: IBarberRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly getAvailableSlotsUseCase: GetAvailableSlotsUseCase,
    private readonly createBookingUseCase: CreateBookingUseCase,
    private readonly getDaySummaryUseCase: GetDaySummaryUseCase,
    private readonly getAvailableDaysUseCase: GetAvailableDaysUseCase,
    private readonly emailService: IEmailService,
  ) {}

  // ── Panel del dueño ───────────────────────────────────────────────────────

  listByDate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fecha =
        (req.query["fecha"] as string) ?? new Date().toISOString().split("T")[0];
      const bookings = await this.bookingRepository.findByBusinessAndDate(
        req.businessId!,
        fecha,
      );
      res.json({ bookings, fecha });
    } catch (error) {
      next(error);
    }
  };

  updateEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const { estado } = req.body as { estado: string };

      const VALID_ESTADOS = ["pendiente", "confirmada", "cancelada"] as const;
      type EstadoValido = (typeof VALID_ESTADOS)[number];

      const isValidEstado = (s: string): s is EstadoValido =>
        (VALID_ESTADOS as readonly string[]).includes(s);

      if (!isValidEstado(estado)) {
        throw new ValidationError(
          `Estado inválido. Valores permitidos: ${VALID_ESTADOS.join(", ")}`,
        );
      }

      const existing = await this.bookingRepository.findById(id);
      if (!existing) throw new NotFoundError("Reserva");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const booking = await this.bookingRepository.updateEstado(id, estado);
      res.json({ booking });
    } catch (error) {
      next(error);
    }
  };

  getMonthSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const year = parseInt(
        (req.query["year"] as string) ?? new Date().getFullYear().toString(),
      );
      const month = parseInt(
        (req.query["month"] as string) ?? (new Date().getMonth() + 1).toString(),
      );

      const summary = await this.bookingRepository.countByMonth(
        req.businessId!,
        year,
        month,
      );
      res.json({ summary, year, month });
    } catch (error) {
      next(error);
    }
  };

  getDaySummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fecha =
        (req.query["fecha"] as string) ?? new Date().toISOString().split("T")[0];

      const result = await this.getDaySummaryUseCase.execute(req.businessId!, fecha);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createPanel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateBookingInput;
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      const service = await this.serviceRepository.findById(input.service_id);
      if (!service) throw new NotFoundError("Servicio");
      if (service.business_id !== business.id) throw new ForbiddenError();

      const barber = await this.barberRepository.findById(input.barber_id);
      if (!barber) throw new NotFoundError("Barbero");
      if (barber.business_id !== business.id) throw new ForbiddenError();

      const businessStatus = getBusinessStatus(business);
      if (businessStatus === "trial_expired" || businessStatus === "paused" || businessStatus === "subscription_expired") {
        throw new AppError("Este negocio no puede crear nuevos turnos con su estado actual", 403);
      }

      await this.checkMonthlyLimit(business.id, business.plan, business.trial_ends_at);

      const hora_fin = this.calcHoraFin(input.hora_inicio, service.duracion_minutos);

      const booking = await this.createBookingUseCase.execute({
        business_id: business.id,
        barber_id: input.barber_id,
        service_id: input.service_id,
        cliente_nombre: input.cliente_nombre,
        cliente_email: input.cliente_email,
        cliente_telefono: input.cliente_telefono,
        fecha: input.fecha,
        hora_inicio: input.hora_inicio,
        hora_fin,
        duracion_minutos: service.duracion_minutos,
        buffer_minutos: business.buffer_minutos,
        auto_confirmar: business.auto_confirmar ?? true,
      });

      this.sendEmailsAsync({
        booking,
        business,
        service: { nombre: service.nombre },
        barber: { nombre: barber.nombre },
      });

      res.status(201).json({
        message: "Turno creado exitosamente",
        booking: {
          id: booking.id,
          fecha: booking.fecha,
          hora_inicio: booking.hora_inicio,
          hora_fin: booking.hora_fin,
          estado: booking.estado,
          cancellation_token: booking.cancellation_token,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Página pública de la barbería ─────────────────────────────────────────

  getAvailableSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params["slug"] as string;
      const barberId = req.query["barber_id"] as string;
      const serviceId = req.query["service_id"] as string;
      const fecha = req.query["fecha"] as string;

      if (!barberId || !serviceId || !fecha) {
        throw new ValidationError("barber_id, service_id y fecha son requeridos");
      }

      const business = await this.businessRepository.findBySlug(slug);
      if (!business) throw new NotFoundError("Negocio");

      const service = await this.serviceRepository.findById(serviceId);
      if (!service) throw new NotFoundError("Servicio");
      if (service.business_id !== business.id) throw new ForbiddenError();

      // No exponer slots de negocios que no aceptan reservas
      const slotStatus = getBusinessStatus(business);
      if (slotStatus === "trial_expired" || slotStatus === "paused" || slotStatus === "subscription_expired") {
        res.json({ slots: [], fecha });
        return;
      }

      const slots = await this.getAvailableSlotsUseCase.execute({
        barberId,
        businessId: business.id,
        fecha,
        duracionMinutos: service.duracion_minutos,
        bufferMinutos: business.buffer_minutos,
      });

      res.json({ slots, fecha });
    } catch (error) {
      next(error);
    }
  };

  getAvailableDays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params["slug"] as string;
      const { year, month, barber_id, service_id } = req.query;

      const y = parseInt((year as string) ?? new Date().getFullYear().toString());
      const m = parseInt((month as string) ?? (new Date().getMonth() + 1).toString());

      const result = await this.getAvailableDaysUseCase.execute({
        slug: slug as string,
        year: y,
        month: m,
        barberId: (barber_id as string) ?? "",
        serviceId: service_id as string | undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params["slug"] as string;
      const input = req.body as CreateBookingInput;

      const business = await this.businessRepository.findBySlug(slug);
      if (!business) throw new NotFoundError("Negocio");

      const service = await this.serviceRepository.findById(input.service_id);
      if (!service) throw new NotFoundError("Servicio");
      if (service.business_id !== business.id) throw new ForbiddenError();

      const barber = await this.barberRepository.findById(input.barber_id);
      if (!barber) throw new NotFoundError("Barbero");

      // Bloquear reservas si el negocio está pausado o su trial venció sin suscripción activa
      const businessStatus = getBusinessStatus(business);
      if (businessStatus === "trial_expired" || businessStatus === "paused" || businessStatus === "subscription_expired") {
        throw new AppError("Este negocio no está aceptando reservas online en este momento", 403);
      }

      await this.checkMonthlyLimit(business.id, business.plan, business.trial_ends_at);

      const hora_fin = this.calcHoraFin(input.hora_inicio, service.duracion_minutos);

      const booking = await this.createBookingUseCase.execute({
        business_id: business.id,
        barber_id: input.barber_id,
        service_id: input.service_id,
        cliente_nombre: input.cliente_nombre,
        cliente_email: input.cliente_email,
        cliente_telefono: input.cliente_telefono,
        fecha: input.fecha,
        hora_inicio: input.hora_inicio,
        hora_fin,
        duracion_minutos: service.duracion_minutos,
        buffer_minutos: business.buffer_minutos,
        auto_confirmar: business.auto_confirmar ?? true,
      });

      this.sendEmailsAsync({
        booking,
        business,
        service: { nombre: service.nombre },
        barber: { nombre: barber.nombre },
      });

      res.status(201).json({
        message: "Reserva creada exitosamente",
        booking: {
          id: booking.id,
          fecha: booking.fecha,
          hora_inicio: booking.hora_inicio,
          hora_fin: booking.hora_fin,
          estado: booking.estado,
          cancellation_token: booking.cancellation_token,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  cancelByToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params["token"] as string;

      const booking = await this.bookingRepository.findByCancellationToken(token);
      if (!booking) throw new NotFoundError("Reserva");

      if (booking.estado === "cancelada") {
        throw new AppError("La reserva ya está cancelada", 400);
      }

      // Parsear la fecha y hora del turno como hora local del servidor.
      // Sin sufijo "Z" ni offset, V8 lo trata como hora local — correcto para fechas
      // de negocio que ya están en la timezone del servidor (America/Montevideo).
      // Si la app escala a múltiples zonas horarias, usar business.timezone aquí.
      const [fyear, fmonth, fday] = booking.fecha.split("-").map(Number);
      const [fhour, fmin] = booking.hora_inicio.split(":").map(Number);
      const bookingDateTime = new Date(fyear, fmonth - 1, fday, fhour, fmin);
      const diffHours = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

      if (diffHours < 24) {
        throw new AppError(
          "No se puede cancelar con menos de 24 horas de anticipación",
          400,
        );
      }

      await this.bookingRepository.updateEstado(booking.id, "cancelada");
      res.json({ message: "Reserva cancelada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── Helpers privados ──────────────────────────────────────────────────────

  private calcHoraFin(horaInicio: string, duracionMinutos: number): string {
    const [h, m] = horaInicio.split(":").map(Number);
    const finMinutes = h * 60 + m + duracionMinutos;
    return `${Math.floor(finMinutes / 60).toString().padStart(2, "0")}:${(
      finMinutes % 60
    )
      .toString()
      .padStart(2, "0")}`;
  }

  private async checkMonthlyLimit(
    businessId: string,
    plan: string,
    trialEndsAt: string | null,
  ): Promise<void> {
    const trialActivo = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
    const limits = getPlanLimits(plan, trialActivo);

    if (limits.maxReservasMes === Infinity) return;

    const now = new Date();
    const count = await this.bookingRepository.countByBusinessAndMonth(
      businessId,
      now.getFullYear(),
      now.getMonth() + 1,
    );

    if (count >= limits.maxReservasMes) {
      throw new AppError(
        `Este negocio alcanzó el límite de ${limits.maxReservasMes} reservas del plan Starter este mes.`,
        403,
      );
    }
  }

  private sendEmailsAsync(params: {
    booking: { cliente_email: string; cliente_nombre: string; fecha: string; hora_inicio: string; hora_fin: string; cancellation_token: string };
    business: { nombre: string; email: string | null; slug: string };
    service: { nombre: string };
    barber: { nombre: string };
  }): void {
    const { booking, business, service, barber } = params;
    const horaInicioFmt = booking.hora_inicio.slice(0, 5);
    const horaFinFmt = booking.hora_fin.slice(0, 5);

    const tasks = [
      this.emailService.sendBookingConfirmation({
        to: booking.cliente_email,
        clienteNombre: booking.cliente_nombre,
        negocioNombre: business.nombre,
        servicioNombre: service.nombre,
        barberoNombre: barber.nombre,
        fecha: booking.fecha,
        horaInicio: horaInicioFmt,
        cancellationToken: booking.cancellation_token,
        slug: business.slug,
      }),
      ...(business.email
        ? [
            this.emailService.sendBookingNotification({
              to: business.email,
              negocioNombre: business.nombre,
              clienteNombre: booking.cliente_nombre,
              clienteEmail: booking.cliente_email,
              clienteTelefono: "",
              servicioNombre: service.nombre,
              barberoNombre: barber.nombre,
              fecha: booking.fecha,
              horaInicio: horaInicioFmt,
              horaFin: horaFinFmt,
            }),
          ]
        : []),
    ];

    Promise.all(tasks).catch((err) => logger.error("Error enviando emails", err));
  }
}
