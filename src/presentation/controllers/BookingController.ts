import { GetAllSlotsForDaysUseCase } from "../../application/bookings/GetAllSlotsForDaysUseCase";
import { ModifyBookingUseCase } from "../../application/bookings/ModifyBookingUseCase";
import { CancelBookingUseCase } from "../../application/bookings/CancelBookingUseCase";
import { AddBookingItemUseCase } from "../../application/bookings/AddBookingItemUseCase";
import { RemoveBookingItemUseCase } from "../../application/bookings/RemoveBookingItemUseCase";
import { getSlotsFromCache, setSlotsCache, invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";
import { Request, Response, NextFunction } from "express";
import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IBookingTicketRepository } from "../../domain/interfaces/IBookingTicketRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { Service } from "../../domain/entities/Service";
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
import { CreateBookingInput, AddBookingItemInput, CerrarTicketInput } from "../schemas/booking.schema";
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
    private readonly getAllSlotsForDaysUseCase: GetAllSlotsForDaysUseCase,
    private readonly modifyBookingUseCase: ModifyBookingUseCase,
    private readonly cancelBookingUseCase: CancelBookingUseCase,
    private readonly addBookingItemUseCase: AddBookingItemUseCase,
    private readonly removeBookingItemUseCase: RemoveBookingItemUseCase,
    private readonly bookingTicketRepository: IBookingTicketRepository,
  ) {}

  // ── Panel del dueño ───────────────────────────────────────────────────────

  listByDate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const fecha = (req.query["fecha"] as string) ?? localToday;
      const bookings = await this.bookingRepository.findByBusinessAndDate(
        req.businessId!,
        fecha,
      );
      const uniqueEmails = [...new Set(bookings.map((booking) => booking.cliente_email))];
      const previousEmails =
        uniqueEmails.length > 0
          ? await this.bookingRepository.findEmailsByBusiness(
              req.businessId!,
              fecha,
              uniqueEmails,
            )
          : [];
      const previousEmailSet = new Set(previousEmails);
      const enrichedBookings = bookings.map((booking) => ({
        ...booking,
        cliente_tipo: previousEmailSet.has(booking.cliente_email)
          ? "recurrente"
          : "nuevo",
      }));

      res.json({ bookings: enrichedBookings, fecha });
    } catch (error) {
      next(error);
    }
  };

  updateEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const { estado } = req.body as { estado: string };

      const VALID_ESTADOS = ["pendiente", "confirmada", "cancelada", "no_show"] as const;
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

      if (estado === "no_show") {
        if (existing.estado === "cancelada") {
          throw new AppError("No se puede marcar como no asistió una reserva cancelada", 400);
        }
        // No tiene sentido marcar "no asistió" antes de que el turno haya
        // empezado — evita que se use como cancelación encubierta para un
        // turno futuro (lo cual además seguiría bloqueando el slot en la
        // agenda, ya que no_show no libera el horario en getAvailableSlots).
        if (this.aunNoEmpezo(existing.fecha, existing.hora_inicio)) {
          throw new AppError(
            "No se puede marcar como no asistió un turno que todavía no empezó",
            400,
          );
        }
      }

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
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const fecha = (req.query["fecha"] as string) ?? localToday;

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

      const serviceIds = this.resolveServiceIds(input);
      const services = await this.serviceRepository.findByIds(serviceIds);
      this.validateServices(services, serviceIds, business.id);

      const barber = await this.barberRepository.findById(input.barber_id);
      if (!barber) throw new NotFoundError("Barbero");
      if (barber.business_id !== business.id) throw new ForbiddenError();

      const businessStatus = getBusinessStatus(business);
      if (businessStatus === "trial_expired" || businessStatus === "paused" || businessStatus === "subscription_expired") {
        throw new AppError("Este negocio no puede crear nuevos turnos con su estado actual", 403);
      }

      await this.checkMonthlyLimit(business.id, business.plan, business.trial_ends_at);

      const duracionTotal = services.reduce((sum, s) => sum + s.duracion_minutos, 0);
      const hora_fin = this.calcHoraFin(input.hora_inicio, duracionTotal);

      const booking = await this.createBookingUseCase.execute({
        business_id: business.id,
        barber_id: input.barber_id,
        items: services.map((s, index) => ({
          service_id: s.id,
          nombre: s.nombre,
          precio: s.precio,
          duracion_minutos: s.duracion_minutos,
          orden: index,
          tiempo_activo_inicial_minutos: s.tiempo_activo_inicial_minutos,
          tiempo_procesamiento_minutos: s.tiempo_procesamiento_minutos,
        })),
        cliente_nombre: input.cliente_nombre,
        cliente_email: input.cliente_email,
        cliente_telefono: input.cliente_telefono,
        fecha: input.fecha,
        hora_inicio: input.hora_inicio,
        hora_fin,
        duracion_minutos: duracionTotal,
        buffer_minutos: business.buffer_minutos,
        auto_confirmar: business.auto_confirmar ?? true,
      });

      this.sendEmailsAsync({
        booking,
        business,
        services,
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
      const fecha = req.query["fecha"] as string;
      const serviceIdsRaw = req.query["service_ids"] as string | undefined;
      const serviceIdLegacy = req.query["service_id"] as string | undefined;
      // service_ids (plural, comma-separated) es lo que manda el frontend para
      // combos de varios servicios. service_id queda como fallback legacy.
      // Antes esto exigía service_id y nunca leía service_ids: para un combo
      // la duración usada para generar los slots quedaba mal (un solo servicio
      // en vez de la suma), desincronizada con la duración real usada al crear
      // la reserva.
      const serviceIds = serviceIdsRaw
        ? serviceIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : serviceIdLegacy
          ? [serviceIdLegacy]
          : [];

      if (!barberId || serviceIds.length === 0 || !fecha) {
        throw new ValidationError("barber_id, service_id(s) y fecha son requeridos");
      }

      const business = await this.businessRepository.findBySlug(slug);
      if (!business) throw new NotFoundError("Negocio");

      const services = await this.serviceRepository.findByIds(serviceIds);
      this.validateServices(services, serviceIds, business.id);
      const duracionTotal = services.reduce((sum, s) => sum + s.duracion_minutos, 0);

      const barber = await this.barberRepository.findById(barberId);
      if (!barber) throw new NotFoundError("Barbero");
      if (barber.business_id !== business.id) throw new ForbiddenError();

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
        duracionMinutos: duracionTotal,
        bufferMinutos: business.buffer_minutos,
        // Necesario para que un barbero con capacidad_sillas > 1 muestre
        // como disponibles los huecos de procesamiento del combo pedido
        // (ver GetAvailableSlotsUseCase) — sin esto, el buscador asumiría
        // que todo el combo es tiempo activo y subestimaría la disponibilidad
        // real para servicios como color/tinte.
        items: services.map((s, index) => ({
          orden: index,
          duracion_minutos: s.duracion_minutos,
          tiempo_activo_inicial_minutos: s.tiempo_activo_inicial_minutos,
          tiempo_procesamiento_minutos: s.tiempo_procesamiento_minutos,
        })),
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

      const serviceIds = this.resolveServiceIds(input);
      const services = await this.serviceRepository.findByIds(serviceIds);
      this.validateServices(services, serviceIds, business.id);

      const barber = await this.barberRepository.findById(input.barber_id);
      if (!barber) throw new NotFoundError("Barbero");
      if (barber.business_id !== business.id) throw new ForbiddenError();

      // Bloquear reservas si el negocio está pausado o su trial venció sin suscripción activa
      const businessStatus = getBusinessStatus(business);
      if (businessStatus === "trial_expired" || businessStatus === "paused" || businessStatus === "subscription_expired") {
        throw new AppError("Este negocio no está aceptando reservas online en este momento", 403);
      }

      await this.checkMonthlyLimit(business.id, business.plan, business.trial_ends_at);

      const duracionTotal = services.reduce((sum, s) => sum + s.duracion_minutos, 0);
      const hora_fin = this.calcHoraFin(input.hora_inicio, duracionTotal);

      const booking = await this.createBookingUseCase.execute({
        business_id: business.id,
        barber_id: input.barber_id,
        items: services.map((s, index) => ({
          service_id: s.id,
          nombre: s.nombre,
          precio: s.precio,
          duracion_minutos: s.duracion_minutos,
          orden: index,
          tiempo_activo_inicial_minutos: s.tiempo_activo_inicial_minutos,
          tiempo_procesamiento_minutos: s.tiempo_procesamiento_minutos,
        })),
        cliente_nombre: input.cliente_nombre,
        cliente_email: input.cliente_email,
        cliente_telefono: input.cliente_telefono,
        fecha: input.fecha,
        hora_inicio: input.hora_inicio,
        hora_fin,
        duracion_minutos: duracionTotal,
        buffer_minutos: business.buffer_minutos,
        auto_confirmar: business.auto_confirmar ?? true,
      });

      this.sendEmailsAsync({
        booking,
        business,
        services,
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

      // Liberar el slot en el cache para que otros clientes lo vean disponible
      // de inmediato, sin esperar el TTL de 2 minutos.
      invalidateSlotsCache(booking.business_id);

      res.json({ message: "Reserva cancelada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── Ítems de detalle (multi-servicio) ─────────────────────────────────────

  /**
   * POST /bookings/panel/:id/items
   * Agrega un servicio o producto a una reserva existente — antes, durante,
   * o después del turno, mientras el ticket de cobro esté 'abierto'. No hay
   * límite de tiempo: el barbero cierra la cuenta cuando termina de cobrar.
   */
  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const input = req.body as AddBookingItemInput;

      const existing = await this.bookingRepository.findById(id);
      if (!existing) throw new NotFoundError("Reserva");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const result = await this.addBookingItemUseCase.execute({
        booking_id: id,
        service_id: input.service_id,
        nombre_personalizado: input.nombre_personalizado,
        precio: input.precio,
        duracion_minutos: input.duracion_minutos,
      });

      if (result.agendaExtendida) {
        invalidateSlotsCache(existing.business_id);
      }

      res.status(201).json({
        booking: result.booking,
        item: result.item,
        agendaExtendida: result.agendaExtendida,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /bookings/panel/:id/items
   * Lista los servicios/productos cobrados en una reserva.
   */
  listItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.bookingRepository.findById(id);
      if (!existing) throw new NotFoundError("Reserva");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const items = await this.bookingRepository.findItemsByBookingId(id);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /bookings/panel/:id/items/:itemId
   * Quita un servicio/producto agregado a una reserva. Sin límite de fecha
   * (igual que addItem) — bloqueado solo si el ticket ya está cobrado.
   */
  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const itemId = req.params["itemId"] as string;

      const existing = await this.bookingRepository.findById(id);
      if (!existing) throw new NotFoundError("Reserva");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.removeBookingItemUseCase.execute({
        booking_id: id,
        item_id: itemId,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /bookings/panel/:id/cerrar-cuenta
   * Marca el ticket de la reserva como cobrado. A partir de acá sus
   * booking_items son inmutables — para corregir, se anula y se recrea.
   */
  cerrarCuenta = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const input = req.body as CerrarTicketInput;

      const existing = await this.bookingRepository.findById(id);
      if (!existing) throw new NotFoundError("Reserva");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const ticket = await this.bookingTicketRepository.cerrar(id, input.metodo_pago ?? null);
      res.json({ ticket });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /public/:slug/available-days-with-slots
   *
   * Precarga todos los slots del mes en una sola llamada.
   * El frontend los cachea en cliente y no necesita más requests al cambiar de día.
   * Mismo costo en BD que /available-days: 3 queries independientemente del mes.
   */
  getAllSlotsForDays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug      = req.params["slug"] as string;
      const { year, month, barber_id, service_id, service_ids } = req.query;

      const y = parseInt((year  as string) ?? new Date().getFullYear().toString());
      const m = parseInt((month as string) ?? (new Date().getMonth() + 1).toString());

      if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
        res.status(400).json({ error: "year y month son requeridos y deben ser válidos" });
        return;
      }

      const barberId  = (barber_id  as string) ?? "";
      // service_ids (plural, comma-separated) es lo que manda el frontend para
      // combos de varios servicios. service_id queda como fallback legacy.
      // Antes esto solo leía service_id: si llegaba service_ids, quedaba vacío
      // y el cálculo de slots caía siempre al default de 30 min.
      const serviceIds = service_ids
        ? (service_ids as string).split(",").map((s) => s.trim()).filter(Boolean)
        : service_id
          ? [service_id as string]
          : [];
      // Clave de cache estable sin importar el orden en que lleguen los ids.
      const serviceCacheKey = [...serviceIds].sort().join(",");

      // Buscar el businessId para la clave de cache
      const business = await this.businessRepository.findBySlug(slug);
      if (!business) {
        res.status(404).json({ error: "Negocio no encontrado" });
        return;
      }

      // Verificar estado del negocio
      const status = getBusinessStatus(business);
      if (status === "trial_expired" || status === "paused" || status === "subscription_expired") {
        res.json({ year: y, month: m, days: [] });
        return;
      }

      // Cache hit — transformar al mismo formato que el resultado fresco
      // antes de este fix, se devolvía { year, month, days:[{fecha,slots}] }
      // pero el frontend espera { availableDays: string[], slots: Record<string, TimeSlot[]> }
      const cached = getSlotsFromCache(business.id, barberId, serviceCacheKey, y, m);
      if (cached) {
        res.json({
          availableDays: cached.days.map((d) => d.fecha),
          slots: Object.fromEntries(cached.days.map((d) => [d.fecha, d.slots])),
        });
        return;
      }

      const result = await this.getAllSlotsForDaysUseCase.execute({
        slug, year: y, month: m, barberId, serviceIds,
      });

      setSlotsCache(business.id, barberId, serviceCacheKey, y, m, result);

      // Transformar al formato esperado por el frontend:
      // { availableDays: string[], slots: Record<string, TimeSlot[]> }
      const availableDays = result.days.map((d) => d.fecha);
      const slots = Object.fromEntries(
        result.days.map((d) => [d.fecha, d.slots]),
      );
      res.json({ availableDays, slots });
    } catch (error) {
      next(error);
    }
  };


  modifyBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id }                                  = req.params;
      const { fecha, hora_inicio, hora_fin,
              barber_id, service_id, service_ids }  = req.body as {
        fecha: string; hora_inicio: string; hora_fin: string;
        barber_id?: string; service_id?: string; service_ids?: string[];
      };

      if (!fecha || !hora_inicio || !hora_fin) {
        res.status(400).json({ error: "fecha, hora_inicio y hora_fin son requeridos" });
        return;
      }

      const booking = await this.modifyBookingUseCase.execute({
        bookingId:  id as string,
        businessId: req.businessId!,
        fecha,
        horaInicio: hora_inicio,
        horaFin:    hora_fin,
        barberId:   barber_id,
        serviceId:  service_id,
        serviceIds: service_ids,
      });

      res.json({ booking });
    } catch (error) {
      next(error);
    }
  };

  cancelBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id }     = req.params;
      const { reason } = req.body as { reason?: string };

      const booking = await this.cancelBookingUseCase.execute({
        bookingId:  id as string,
        businessId: req.businessId!,
        reason,
      });

      res.json({ booking });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /panel/month-full?year=Y&month=M
   *
   * Devuelve todas las reservas del mes calendario del panel del dueño con
   * detalle completo. El frontend las cachea en un Map<fecha, Booking[]> y
   * lee localmente al hacer click en cada día — cero requests adicionales.
   */
  getMonthFull = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const year  = parseInt((req.query["year"]  as string) ?? new Date().getFullYear().toString());
      const month = parseInt((req.query["month"] as string) ?? (new Date().getMonth() + 1).toString());

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: "year y month son requeridos y deben ser válidos" });
        return;
      }

      const bookings = await this.bookingRepository.findByBusinessAndMonth(
        req.businessId!,
        year,
        month,
      );

      // Enriquecer con cliente_tipo (nuevo / recurrente)
      const firstDayStr = `${year}-${month.toString().padStart(2, "0")}-01`;
      const uniqueEmails = [...new Set(bookings.map((b) => b.cliente_email))];
      const previousEmails =
        uniqueEmails.length > 0
          ? await this.bookingRepository.findEmailsByBusiness(
              req.businessId!,
              firstDayStr,
              uniqueEmails,
            )
          : [];
      const previousEmailSet = new Set(previousEmails);

      const enriched = bookings.map((b) => ({
        ...b,
        cliente_tipo: previousEmailSet.has(b.cliente_email) ? "recurrente" : "nuevo",
      }));

      res.json({ bookings: enriched, year, month });
    } catch (error) {
      next(error);
    }
  };

  // ── Helpers privados ──────────────────────────────────────────────────────

  /** Normaliza service_id (legacy) y service_ids (nuevo) a un solo array. */
  private resolveServiceIds(input: CreateBookingInput): string[] {
    if (input.service_ids?.length) return input.service_ids;
    if (input.service_id) return [input.service_id];
    throw new ValidationError("Se requiere service_id o service_ids");
  }

  private validateServices(services: Service[], requestedIds: string[], businessId: string): void {
    if (services.length !== requestedIds.length) {
      throw new NotFoundError("Servicio");
    }
    if (services.some((s) => s.business_id !== businessId)) {
      throw new ForbiddenError();
    }
  }

  private calcHoraFin(horaInicio: string, duracionMinutos: number): string {
    const [h, m] = horaInicio.split(":").map(Number);
    const finMinutes = h * 60 + m + duracionMinutos;
    return `${Math.floor(finMinutes / 60).toString().padStart(2, "0")}:${(
      finMinutes % 60
    )
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * true si la fecha+hora_inicio del turno todavía no llegó. Parsea como
   * hora local del servidor, mismo criterio que cancelByToken — ver el
   * comentario ahí sobre por qué no usar Date.parse con el string ISO directo.
   */
  private aunNoEmpezo(fecha: string, horaInicio: string): boolean {
    const [year, month, day] = fecha.split("-").map(Number);
    const [hour, min] = horaInicio.split(":").map(Number);
    const turnoDateTime = new Date(year, month - 1, day, hour, min);
    return turnoDateTime.getTime() > Date.now();
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
    business: { nombre: string; email: string | null; slug: string; custom_domain: string | null };
    services: Service[];
    barber: { nombre: string };
  }): void {
    const { booking, business, services, barber } = params;
    const horaInicioFmt = booking.hora_inicio.slice(0, 5);
    const horaFinFmt = booking.hora_fin.slice(0, 5);
    // Lista legible de servicios para el email — "Corte de pelo + Lavado".
    const servicioNombre = services.map((s) => s.nombre).join(" + ");

    const tasks = [
      this.emailService.sendBookingConfirmation({
        to: booking.cliente_email,
        clienteNombre: booking.cliente_nombre,
        negocioNombre: business.nombre,
        servicioNombre,
        barberoNombre: barber.nombre,
        fecha: booking.fecha,
        horaInicio: horaInicioFmt,
        cancellationToken: booking.cancellation_token,
        slug: business.slug,
        customDomain: business.custom_domain,
      }),
      // Notificar al dueño solo si tiene email configurado, para evitar rebotes y saturación de logs
      // ...(business.email
      //   ? [
      //       this.emailService.sendBookingNotification({
      //         to: business.email,
      //         negocioNombre: business.nombre,
      //         clienteNombre: booking.cliente_nombre,
      //         clienteEmail: booking.cliente_email,
      //         clienteTelefono: "",
      //         servicioNombre,
      //         barberoNombre: barber.nombre,
      //         fecha: booking.fecha,
      //         horaInicio: horaInicioFmt,
      //         horaFin: horaFinFmt,
      //       }),
      //     ]
      //   : []),
    ];

    Promise.all(tasks).catch((err) => logger.error("Error enviando emails", err));
  }

}
