"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingController = void 0;
const errors_1 = require("../../domain/errors");
const plan_limits_1 = require("../../domain/plan-limits");
const business_status_1 = require("../../domain/business-status");
const logger_1 = require("../../infrastructure/logger");
class BookingController {
    constructor(bookingRepository, barberRepository, serviceRepository, businessRepository, getAvailableSlotsUseCase, createBookingUseCase, getDaySummaryUseCase, getAvailableDaysUseCase, emailService) {
        this.bookingRepository = bookingRepository;
        this.barberRepository = barberRepository;
        this.serviceRepository = serviceRepository;
        this.businessRepository = businessRepository;
        this.getAvailableSlotsUseCase = getAvailableSlotsUseCase;
        this.createBookingUseCase = createBookingUseCase;
        this.getDaySummaryUseCase = getDaySummaryUseCase;
        this.getAvailableDaysUseCase = getAvailableDaysUseCase;
        this.emailService = emailService;
        // ── Panel del dueño ───────────────────────────────────────────────────────
        this.listByDate = async (req, res, next) => {
            try {
                const fecha = req.query["fecha"] ?? new Date().toISOString().split("T")[0];
                const bookings = await this.bookingRepository.findByBusinessAndDate(req.businessId, fecha);
                res.json({ bookings, fecha });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateEstado = async (req, res, next) => {
            try {
                const id = req.params["id"];
                const { estado } = req.body;
                const VALID_ESTADOS = ["pendiente", "confirmada", "cancelada"];
                const isValidEstado = (s) => VALID_ESTADOS.includes(s);
                if (!isValidEstado(estado)) {
                    throw new errors_1.ValidationError(`Estado inválido. Valores permitidos: ${VALID_ESTADOS.join(", ")}`);
                }
                const existing = await this.bookingRepository.findById(id);
                if (!existing)
                    throw new errors_1.NotFoundError("Reserva");
                if (existing.business_id !== req.businessId)
                    throw new errors_1.ForbiddenError();
                const booking = await this.bookingRepository.updateEstado(id, estado);
                res.json({ booking });
            }
            catch (error) {
                next(error);
            }
        };
        this.getMonthSummary = async (req, res, next) => {
            try {
                const year = parseInt(req.query["year"] ?? new Date().getFullYear().toString());
                const month = parseInt(req.query["month"] ?? (new Date().getMonth() + 1).toString());
                const summary = await this.bookingRepository.countByMonth(req.businessId, year, month);
                res.json({ summary, year, month });
            }
            catch (error) {
                next(error);
            }
        };
        this.getDaySummary = async (req, res, next) => {
            try {
                const fecha = req.query["fecha"] ?? new Date().toISOString().split("T")[0];
                const result = await this.getDaySummaryUseCase.execute(req.businessId, fecha);
                res.json(result);
            }
            catch (error) {
                next(error);
            }
        };
        this.createPanel = async (req, res, next) => {
            try {
                const input = req.body;
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                const service = await this.serviceRepository.findById(input.service_id);
                if (!service)
                    throw new errors_1.NotFoundError("Servicio");
                if (service.business_id !== business.id)
                    throw new errors_1.ForbiddenError();
                const barber = await this.barberRepository.findById(input.barber_id);
                if (!barber)
                    throw new errors_1.NotFoundError("Barbero");
                if (barber.business_id !== business.id)
                    throw new errors_1.ForbiddenError();
                const businessStatus = (0, business_status_1.getBusinessStatus)(business);
                if (businessStatus === "trial_expired" || businessStatus === "paused") {
                    throw new errors_1.AppError("Este negocio no puede crear nuevos turnos con su estado actual", 403);
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
            }
            catch (error) {
                next(error);
            }
        };
        // ── Página pública de la barbería ─────────────────────────────────────────
        this.getAvailableSlots = async (req, res, next) => {
            try {
                const slug = req.params["slug"];
                const barberId = req.query["barber_id"];
                const serviceId = req.query["service_id"];
                const fecha = req.query["fecha"];
                if (!barberId || !serviceId || !fecha) {
                    throw new errors_1.ValidationError("barber_id, service_id y fecha son requeridos");
                }
                const business = await this.businessRepository.findBySlug(slug);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                const service = await this.serviceRepository.findById(serviceId);
                if (!service)
                    throw new errors_1.NotFoundError("Servicio");
                if (service.business_id !== business.id)
                    throw new errors_1.ForbiddenError();
                // No exponer slots de negocios que no aceptan reservas
                const slotStatus = (0, business_status_1.getBusinessStatus)(business);
                if (slotStatus === "trial_expired" || slotStatus === "paused") {
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
            }
            catch (error) {
                next(error);
            }
        };
        this.getAvailableDays = async (req, res, next) => {
            try {
                const slug = req.params["slug"];
                const { year, month, barber_id, service_id } = req.query;
                const y = parseInt(year ?? new Date().getFullYear().toString());
                const m = parseInt(month ?? (new Date().getMonth() + 1).toString());
                const result = await this.getAvailableDaysUseCase.execute({
                    slug: slug,
                    year: y,
                    month: m,
                    barberId: barber_id ?? "",
                    serviceId: service_id,
                });
                res.json(result);
            }
            catch (error) {
                next(error);
            }
        };
        this.createPublic = async (req, res, next) => {
            try {
                const slug = req.params["slug"];
                const input = req.body;
                const business = await this.businessRepository.findBySlug(slug);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                const service = await this.serviceRepository.findById(input.service_id);
                if (!service)
                    throw new errors_1.NotFoundError("Servicio");
                if (service.business_id !== business.id)
                    throw new errors_1.ForbiddenError();
                const barber = await this.barberRepository.findById(input.barber_id);
                if (!barber)
                    throw new errors_1.NotFoundError("Barbero");
                // Bloquear reservas si el negocio está pausado o su trial venció sin suscripción activa
                const businessStatus = (0, business_status_1.getBusinessStatus)(business);
                if (businessStatus === "trial_expired" || businessStatus === "paused") {
                    throw new errors_1.AppError("Este negocio no está aceptando reservas online en este momento", 403);
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
            }
            catch (error) {
                next(error);
            }
        };
        this.cancelByToken = async (req, res, next) => {
            try {
                const token = req.params["token"];
                const booking = await this.bookingRepository.findByCancellationToken(token);
                if (!booking)
                    throw new errors_1.NotFoundError("Reserva");
                if (booking.estado === "cancelada") {
                    throw new errors_1.AppError("La reserva ya está cancelada", 400);
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
                    throw new errors_1.AppError("No se puede cancelar con menos de 24 horas de anticipación", 400);
                }
                await this.bookingRepository.updateEstado(booking.id, "cancelada");
                res.json({ message: "Reserva cancelada correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    calcHoraFin(horaInicio, duracionMinutos) {
        const [h, m] = horaInicio.split(":").map(Number);
        const finMinutes = h * 60 + m + duracionMinutos;
        return `${Math.floor(finMinutes / 60).toString().padStart(2, "0")}:${(finMinutes % 60)
            .toString()
            .padStart(2, "0")}`;
    }
    async checkMonthlyLimit(businessId, plan, trialEndsAt) {
        const trialActivo = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
        const limits = (0, plan_limits_1.getPlanLimits)(plan, trialActivo);
        if (limits.maxReservasMes === Infinity)
            return;
        const now = new Date();
        const count = await this.bookingRepository.countByBusinessAndMonth(businessId, now.getFullYear(), now.getMonth() + 1);
        if (count >= limits.maxReservasMes) {
            throw new errors_1.AppError(`Este negocio alcanzó el límite de ${limits.maxReservasMes} reservas del plan Starter este mes.`, 403);
        }
    }
    sendEmailsAsync(params) {
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
        Promise.all(tasks).catch((err) => logger_1.logger.error("Error enviando emails", err));
    }
}
exports.BookingController = BookingController;
//# sourceMappingURL=BookingController.js.map