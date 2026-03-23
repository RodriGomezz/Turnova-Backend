import { Request, Response, NextFunction } from 'express';
import { BookingRepository } from '../../infrastructure/database/BookingRepository';
import { ScheduleRepository } from '../../infrastructure/database/ScheduleRepository';
import { BlockedDateRepository } from '../../infrastructure/database/BlockedDateRepository';
import { ServiceRepository } from '../../infrastructure/database/ServiceRepository';
import { BusinessRepository } from '../../infrastructure/database/BusinessRepository';
import { BarberRepository } from '../../infrastructure/database/BarberRepository';
import { GetAvailableSlotsUseCase } from '../../application/bookings/GetAvailableSlotsUseCase';
import { CreateBookingUseCase } from '../../application/bookings/CreateBookingUseCase';
import { NotFoundError, ForbiddenError, AppError } from '../middlewares/errorHandler.middleware';
import { CreateBookingInput } from '../schemas/booking.schema';
import { EmailService } from '../../application/email/email.service';
import { getPlanLimits } from '../../domain/plan-limits';
import { logger } from '../../infrastructure/logger';

export class BookingController {
  private bookingRepository: BookingRepository;
  private barberRepository: BarberRepository;
  private serviceRepository: ServiceRepository;
  private businessRepository: BusinessRepository;
  private scheduleRepository: ScheduleRepository;
  private blockedDateRepository: BlockedDateRepository;
  private getAvailableSlotsUseCase: GetAvailableSlotsUseCase;
  private createBookingUseCase: CreateBookingUseCase;
  private emailService: EmailService;

  constructor() {
    this.bookingRepository = new BookingRepository();
    this.barberRepository = new BarberRepository();
    this.serviceRepository = new ServiceRepository();
    this.businessRepository = new BusinessRepository();
    this.emailService = new EmailService();

    this.scheduleRepository = new ScheduleRepository();
    this.blockedDateRepository = new BlockedDateRepository();
    this.getAvailableSlotsUseCase = new GetAvailableSlotsUseCase(
      this.bookingRepository,
      this.scheduleRepository,
      this.blockedDateRepository,
    );

    this.createBookingUseCase = new CreateBookingUseCase(
      this.bookingRepository,
      this.getAvailableSlotsUseCase,
    );
  }

  // ── Panel del dueño ───────────────────────────────────────────

  listByDate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const fecha =
        (req.query["fecha"] as string) ??
        new Date().toISOString().split("T")[0];
      const bookings = await this.bookingRepository.findByBusinessAndDate(
        req.businessId!,
        fecha,
      );
      res.json({ bookings, fecha });
    } catch (error) {
      next(error);
    }
  };

  updateEstado = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const { estado } = req.body;

      if (!["pendiente", "confirmada", "cancelada"].includes(estado)) {
        throw new AppError("Estado inválido", 400);
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

  // ── Página pública de la barbería ─────────────────────────────

  getAvailableSlots = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { slug } = req.params;
      const barberId = req.query["barber_id"] as string;
      const serviceId = req.query["service_id"] as string;
      const fecha = req.query["fecha"] as string;

      if (!barberId || !serviceId || !fecha) {
        throw new AppError("barber_id, service_id y fecha son requeridos", 400);
      }

      const business = await this.businessRepository.findBySlug(slug as string);
      if (!business) throw new NotFoundError("Negocio");

      const service = await this.serviceRepository.findById(serviceId);
      if (!service) throw new NotFoundError("Servicio");
      if (service.business_id !== business.id) throw new ForbiddenError();

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

  createPublic = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { slug } = req.params;
      const input = req.body as CreateBookingInput;

      const business = await this.businessRepository.findBySlug(slug as string);
      if (!business) throw new NotFoundError("Negocio");

      const service = await this.serviceRepository.findById(input.service_id);
      if (!service) throw new NotFoundError("Servicio");
      if (service.business_id !== business.id) throw new ForbiddenError();

      // Calcular hora_fin en base a duración del servicio
      const [h, m] = input.hora_inicio.split(":").map(Number);
      const finMinutes = h * 60 + m + service.duracion_minutos;
      const hora_fin = `${Math.floor(finMinutes / 60)
        .toString()
        .padStart(2, "0")}:${(finMinutes % 60).toString().padStart(2, "0")}`;

      const barber = await this.barberRepository.findById(input.barber_id);
      if (!barber) throw new NotFoundError("Barbero");
      const trialActivo = business.trial_ends_at
        ? new Date(business.trial_ends_at) > new Date()
        : false;
      const limits = getPlanLimits(business.plan, trialActivo);

      if (limits.maxReservasMes !== Infinity) {
        const now = new Date();
        const count = await this.bookingRepository.countByBusinessAndMonth(
          business.id,
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

      // Emails en paralelo — no bloqueamos la respuesta
      const horaInicioFormateada = booking.hora_inicio.slice(0, 5);
      const horaFinFormateada = booking.hora_fin.slice(0, 5);

      Promise.all([
        // Email al cliente
        this.emailService.sendBookingConfirmation({
          to: booking.cliente_email,
          clienteNombre: booking.cliente_nombre,
          negocioNombre: business.nombre,
          servicioNombre: service.nombre,
          barberoNombre: barber.nombre,
          fecha: booking.fecha,
          horaInicio: horaInicioFormateada,
          cancellationToken: booking.cancellation_token,
          slug: business.slug,
        }),
        // Notificación al dueño (solo si tiene email)
        ...(business.email
          ? [
              this.emailService.sendBookingNotification({
                to: business.email,
                negocioNombre: business.nombre,
                clienteNombre: booking.cliente_nombre,
                clienteEmail: booking.cliente_email,
                clienteTelefono: booking.cliente_telefono,
                servicioNombre: service.nombre,
                barberoNombre: barber.nombre,
                fecha: booking.fecha,
                horaInicio: horaInicioFormateada,
                horaFin: horaFinFormateada,
              }),
            ]
          : []),
      ]).catch((err) => logger.error("Error enviando emails", err));

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

  cancelByToken = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { token } = req.params;

      const booking = await this.bookingRepository.findByCancellationToken(
        token as string,
      );
      if (!booking) throw new NotFoundError("Reserva");

      if (booking.estado === "cancelada") {
        throw new AppError("La reserva ya está cancelada", 400);
      }

      // No permitir cancelar con menos de 2 horas de anticipación
      const bookingDateTime = new Date(
        `${booking.fecha}T${booking.hora_inicio}`,
      );
      const now = new Date();
      const diffHours =
        (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
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

  getMonthSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const year = parseInt(
        (req.query["year"] as string) ?? new Date().getFullYear().toString(),
      );
      const month = parseInt(
        (req.query["month"] as string) ??
          (new Date().getMonth() + 1).toString(),
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

  getAvailableDays = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { slug } = req.params;
      const { year, month, barber_id, service_id } = req.query;

      const business = await this.businessRepository.findBySlug(slug as string);
      if (!business) throw new NotFoundError("Negocio");

      const y = parseInt(
        (year as string) ?? new Date().getFullYear().toString(),
      );
      const m = parseInt(
        (month as string) ?? (new Date().getMonth() + 1).toString(),
      );

      const firstDay = `${y}-${m.toString().padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0);
      const lastDayStr = `${y}-${m.toString().padStart(2, "0")}-${lastDay.getDate().toString().padStart(2, "0")}`;

      const service = service_id
        ? await this.serviceRepository.findById(service_id as string)
        : null;

      const duracion = service?.duracion_minutos ?? 30;
      const buffer = business.buffer_minutos ?? 0;
      const bid = (barber_id as string) ?? "";

      // Cargar todo en paralelo — 1 sola vez
      const [schedules, blockedDates, existingBookings] = await Promise.all([
        this.scheduleRepository.findAllByBusiness(
          business.id,
          bid || undefined,
        ),
        this.blockedDateRepository.findByBusiness(business.id),
        this.bookingRepository.findByBarberAndMonth(
          bid,
          business.id,
          firstDay,
          lastDayStr,
        ),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 7);

      const availableDays: string[] = [];

      for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(y, m - 1, d);
        const dateStr = `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;

        if (date < today || date > maxDate) continue;

        const diaSemana = date.getDay();

        // Verificar si está bloqueado
        const isBlocked = blockedDates.some((bd) => {
          const matchesBusiness = bd.barber_id === null;
          const matchesBarber = bd.barber_id === bid;
          if (!matchesBusiness && !matchesBarber) return false;
          return dateStr >= bd.fecha && dateStr <= (bd.fecha_fin ?? bd.fecha);
        });

        if (isBlocked) continue;

        // Verificar si tiene horario
        const schedule = schedules.find(
          (s) => s.dia_semana === diaSemana && s.activo,
        );
        if (!schedule) continue;

        // Calcular slots disponibles en memoria
        const [hIni, mIni] = schedule.hora_inicio
          .replace(":00", "")
          .split(":")
          .map(Number);
        const [hFin, mFin] = schedule.hora_fin
          .replace(":00", "")
          .split(":")
          .map(Number);
        const inicio = hIni * 60 + mIni;
        const fin = hFin * 60 + mFin;

        const bookingsDelDia = existingBookings.filter(
          (b) => b.fecha === dateStr,
        );

        let hasSlot = false;
        for (let t = inicio; t + duracion <= fin; t += duracion + buffer) {
          const hora = `${Math.floor(t / 60)
            .toString()
            .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
          const ocupado = bookingsDelDia.some(
            (b) => b.hora_inicio.slice(0, 5) === hora,
          );
          if (!ocupado) {
            hasSlot = true;
            break;
          }
        }

        if (hasSlot) availableDays.push(dateStr);
      }

      res.json({ availableDays, year: y, month: m });
    } catch (error) {
      next(error);
    }
  };

  getDaySummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const businessId = req.businessId!;
      const fecha =
        (req.query["fecha"] as string) ??
        new Date().toISOString().split("T")[0];

      const business = await this.businessRepository.findById(businessId);
      if (!business) throw new NotFoundError("Negocio");

      // Parsear fecha sin timezone
      const [year, month, day] = fecha.split("-").map(Number);
      const diaSemana = new Date(year, month - 1, day).getDay() as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6;

      const [bookings, schedules, blockedDates, barbers] = await Promise.all([
        this.bookingRepository.findByBusinessAndDate(businessId, fecha),
        this.scheduleRepository.findAllByBusiness(businessId),
        this.blockedDateRepository.findByBusiness(businessId),
        this.barberRepository.findByBusiness(businessId),
      ]);

      const activos = bookings.filter((b) => b.estado !== "cancelada");
      const buffer = business.buffer_minutos ?? 0;

      // ── Ocupación del día ──────────────────────────────────────────────────
      // Calcular slots totales sumando todos los profesionales activos
      let totalSlots = 0;
      let ocupados = 0;

      for (const barber of barbers) {
        const schedule =
          schedules.find(
            (s) =>
              s.barber_id === barber.id &&
              s.dia_semana === diaSemana &&
              s.activo,
          ) ??
          schedules.find(
            (s) =>
              s.barber_id === null && s.dia_semana === diaSemana && s.activo,
          );

        if (!schedule) continue;

        const isBlocked = blockedDates.some((bd) => {
          const matchesBusiness = bd.barber_id === null;
          const matchesBarber = bd.barber_id === barber.id;
          if (!matchesBusiness && !matchesBarber) return false;
          return fecha >= bd.fecha && fecha <= (bd.fecha_fin ?? bd.fecha);
        });

        if (isBlocked) continue;

        const [hIni, mIni] = schedule.hora_inicio
          .slice(0, 5)
          .split(":")
          .map(Number);
        const [hFin, mFin] = schedule.hora_fin
          .slice(0, 5)
          .split(":")
          .map(Number);
        const inicio = hIni * 60 + mIni;
        const fin = hFin * 60 + mFin;

        // Slots de 30 min como unidad base para calcular ocupación
        const slotSize = 30;
        const slotsBarber = Math.floor((fin - inicio) / (slotSize + buffer));
        const bookingsBarber = activos.filter(
          (b) => b.barber_id === barber.id,
        ).length;

        totalSlots += slotsBarber;
        ocupados += Math.min(bookingsBarber, slotsBarber);
      }

      const ocupacionPct =
        totalSlots > 0 ? Math.round((ocupados / totalSlots) * 100) : 0;

      // ── Ingreso proyectado ─────────────────────────────────────────────────
      const ingresoDia = activos.reduce(
        (sum, b) => sum + ((b as any).services?.precio ?? 0),
        0,
      );

      // ── Primer turno libre ─────────────────────────────────────────────────
      const now = new Date();
      const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const esHoy = fecha === now.toISOString().split("T")[0];

      let primerTurnoLibre: string | null = null;

      for (const barber of barbers) {
        const schedule =
          schedules.find(
            (s) =>
              s.barber_id === barber.id &&
              s.dia_semana === diaSemana &&
              s.activo,
          ) ??
          schedules.find(
            (s) =>
              s.barber_id === null && s.dia_semana === diaSemana && s.activo,
          );

        if (!schedule) continue;

        const [hIni, mIni] = schedule.hora_inicio
          .slice(0, 5)
          .split(":")
          .map(Number);
        const [hFin, mFin] = schedule.hora_fin
          .slice(0, 5)
          .split(":")
          .map(Number);
        const inicio = hIni * 60 + mIni;
        const fin = hFin * 60 + mFin;

        const bookingsBarber = activos
          .filter((b) => b.barber_id === barber.id)
          .map((b) => b.hora_inicio.slice(0, 5));

        for (let t = inicio; t + 30 <= fin; t += 30 + buffer) {
          const hora = `${Math.floor(t / 60)
            .toString()
            .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
          if (esHoy && hora <= horaActual) continue;
          if (!bookingsBarber.includes(hora)) {
            if (!primerTurnoLibre || hora < primerTurnoLibre) {
              primerTurnoLibre = hora;
            }
            break;
          }
        }
      }

      // ── Clientes nuevos hoy ────────────────────────────────────────────────
      const emailsHoy = [...new Set(activos.map((b) => b.cliente_email))];
      let clientesNuevosHoy = 0;

      if (emailsHoy.length > 0) {
        const emailsPrevios = await this.bookingRepository.findEmailsByBusiness(
          businessId,
          fecha,
          emailsHoy,
        );
        const setPrevios = new Set(emailsPrevios);
        clientesNuevosHoy = emailsHoy.filter(e => !setPrevios.has(e)).length;
      }

      // ── Resumen por profesional ────────────────────────────────────────────
      const resumenBarbers = barbers.map((barber) => {
        const turnosBarber = activos.filter(
          (b) => b.barber_id === barber.id,
        ).length;
        const schedule =
          schedules.find(
            (s) =>
              s.barber_id === barber.id &&
              s.dia_semana === diaSemana &&
              s.activo,
          ) ??
          schedules.find(
            (s) =>
              s.barber_id === null && s.dia_semana === diaSemana && s.activo,
          );

        const trabajaHoy =
          !!schedule &&
          !blockedDates.some((bd) => {
            const match = bd.barber_id === null || bd.barber_id === barber.id;
            return (
              match && fecha >= bd.fecha && fecha <= (bd.fecha_fin ?? bd.fecha)
            );
          });

        const ingreso = activos
          .filter((b) => b.barber_id === barber.id)
          .reduce((sum, b) => sum + ((b as any).services?.precio ?? 0), 0);

        return {
          id: barber.id,
          nombre: barber.nombre,
          foto_url: barber.foto_url,
          trabajaHoy,
          turnos: turnosBarber,
          ingreso,
        };
      });

      // ── Día no laborable ───────────────────────────────────────────────────
      const esDiaNoLaborable =
        barbers.length > 0 && resumenBarbers.every((b) => !b.trabajaHoy);

      res.json({
        fecha,
        resumen: {
          totalTurnos: activos.length,
          cancelados: bookings.filter((b) => b.estado === "cancelada").length,
          pendientes: bookings.filter((b) => b.estado === "pendiente").length,
          confirmados: bookings.filter((b) => b.estado === "confirmada").length,
          ingresoDia,
          ocupacionPct,
          primerTurnoLibre,
          clientesNuevosHoy,
          esDiaNoLaborable,
        },
        barbers: resumenBarbers,
      });
    } catch (error) {
      next(error);
    }
  };
}