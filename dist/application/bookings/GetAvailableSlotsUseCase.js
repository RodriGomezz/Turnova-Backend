"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAvailableSlotsUseCase = void 0;
class GetAvailableSlotsUseCase {
    constructor(bookingRepository, scheduleRepository, blockedDateRepository) {
        this.bookingRepository = bookingRepository;
        this.scheduleRepository = scheduleRepository;
        this.blockedDateRepository = blockedDateRepository;
    }
    async execute(input) {
        const diaSemana = this.parseDiaSemana(input.fecha);
        const isBlocked = await this.blockedDateRepository.isBlocked(input.businessId, input.barberId, input.fecha);
        if (isBlocked)
            return [];
        const schedule = await this.scheduleRepository.findForBarber(input.businessId, input.barberId, diaSemana);
        if (!schedule)
            return [];
        const existingBookings = await this.bookingRepository.findByBarberAndDate(input.barberId, input.fecha);
        const slots = this.generateSlots(this.normalizeTime(schedule.hora_inicio), this.normalizeTime(schedule.hora_fin), input.duracionMinutos, input.bufferMinutos);
        return slots.map((slot) => ({
            ...slot,
            disponible: !this.isSlotTaken(slot, existingBookings),
        }));
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    /**
     * Parsea la fecha como fecha local para evitar bugs de timezone.
     * "2025-01-15" → Date(2025, 0, 15) → .getDay()
     */
    parseDiaSemana(fecha) {
        const [year, month, day] = fecha.split("-").map(Number);
        return new Date(year, month - 1, day).getDay();
    }
    normalizeTime(time) {
        return time.slice(0, 5);
    }
    generateSlots(horaInicio, horaFin, duracion, buffer) {
        const slots = [];
        const endMinutes = this.timeToMinutes(horaFin);
        let current = this.timeToMinutes(horaInicio);
        while (current + duracion <= endMinutes) {
            slots.push({
                hora_inicio: this.minutesToTime(current),
                hora_fin: this.minutesToTime(current + duracion),
                disponible: true,
            });
            current += duracion + buffer;
        }
        return slots;
    }
    isSlotTaken(slot, bookings) {
        const slotStart = this.timeToMinutes(slot.hora_inicio);
        const slotEnd = this.timeToMinutes(slot.hora_fin);
        return bookings.some((booking) => {
            const bookingStart = this.timeToMinutes(booking.hora_inicio);
            const bookingEnd = this.timeToMinutes(booking.hora_fin);
            return slotStart < bookingEnd && slotEnd > bookingStart;
        });
    }
    timeToMinutes(time) {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
    }
    minutesToTime(minutes) {
        const h = Math.floor(minutes / 60).toString().padStart(2, "0");
        const m = (minutes % 60).toString().padStart(2, "0");
        return `${h}:${m}`;
    }
}
exports.GetAvailableSlotsUseCase = GetAvailableSlotsUseCase;
//# sourceMappingURL=GetAvailableSlotsUseCase.js.map