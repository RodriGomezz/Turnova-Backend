"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAvailableDaysUseCase = void 0;
const errors_1 = require("../../domain/errors");
class GetAvailableDaysUseCase {
    constructor(businessRepository, serviceRepository, scheduleRepository, blockedDateRepository, bookingRepository) {
        this.businessRepository = businessRepository;
        this.serviceRepository = serviceRepository;
        this.scheduleRepository = scheduleRepository;
        this.blockedDateRepository = blockedDateRepository;
        this.bookingRepository = bookingRepository;
    }
    async execute(input) {
        const business = await this.businessRepository.findBySlug(input.slug);
        if (!business)
            throw new errors_1.NotFoundError("Negocio");
        const service = input.serviceId
            ? await this.serviceRepository.findById(input.serviceId)
            : null;
        const duracion = service?.duracion_minutos ?? 30;
        const buffer = business.buffer_minutos ?? 0;
        const { year: y, month: m } = input;
        const firstDay = `${y}-${m.toString().padStart(2, "0")}-01`;
        const lastDayDate = new Date(y, m, 0);
        const lastDayStr = `${y}-${m.toString().padStart(2, "0")}-${lastDayDate
            .getDate()
            .toString()
            .padStart(2, "0")}`;
        const [schedules, blockedDates, existingBookings] = await Promise.all([
            this.scheduleRepository.findAllByBusiness(business.id, input.barberId || undefined),
            this.blockedDateRepository.findByBusiness(business.id),
            this.bookingRepository.findByBarberAndMonth(input.barberId, business.id, firstDay, lastDayStr),
        ]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + GetAvailableDaysUseCase.MAX_DAYS_AHEAD);
        const availableDays = [];
        for (let d = 1; d <= lastDayDate.getDate(); d++) {
            const date = new Date(y, m - 1, d);
            if (date < today || date > maxDate)
                continue;
            const dateStr = `${y}-${m.toString().padStart(2, "0")}-${d
                .toString()
                .padStart(2, "0")}`;
            if (this.isDateBlocked(dateStr, input.barberId, blockedDates))
                continue;
            const schedule = schedules.find((s) => s.dia_semana === date.getDay() && s.activo);
            if (!schedule)
                continue;
            if (this.hasAvailableSlot(dateStr, schedule, existingBookings, duracion, buffer)) {
                availableDays.push(dateStr);
            }
        }
        return { availableDays, year: y, month: m };
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    isDateBlocked(dateStr, barberId, blockedDates) {
        return blockedDates.some((bd) => {
            const matchesBusiness = bd.barber_id === null;
            const matchesBarber = bd.barber_id === barberId;
            if (!matchesBusiness && !matchesBarber)
                return false;
            return dateStr >= bd.fecha && dateStr <= (bd.fecha_fin ?? bd.fecha);
        });
    }
    hasAvailableSlot(dateStr, schedule, existingBookings, duracion, buffer) {
        const inicio = this.parseMinutes(schedule.hora_inicio);
        const fin = this.parseMinutes(schedule.hora_fin);
        const bookingsDelDia = existingBookings.filter((b) => b.fecha === dateStr);
        for (let t = inicio; t + duracion <= fin; t += duracion + buffer) {
            const hora = this.minutesToTime(t);
            const ocupado = bookingsDelDia.some((b) => b.hora_inicio.slice(0, 5) === hora);
            if (!ocupado)
                return true;
        }
        return false;
    }
    parseMinutes(time) {
        const normalized = time.slice(0, 5);
        const [h, m] = normalized.split(":").map(Number);
        return h * 60 + m;
    }
    minutesToTime(minutes) {
        const h = Math.floor(minutes / 60).toString().padStart(2, "0");
        const m = (minutes % 60).toString().padStart(2, "0");
        return `${h}:${m}`;
    }
}
exports.GetAvailableDaysUseCase = GetAvailableDaysUseCase;
/** Días máximos hacia adelante que se permiten reservar */
GetAvailableDaysUseCase.MAX_DAYS_AHEAD = 7;
//# sourceMappingURL=GetAvailableDaysUseCase.js.map