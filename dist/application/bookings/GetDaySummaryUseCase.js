"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetDaySummaryUseCase = void 0;
const errors_1 = require("../../domain/errors");
// ── Use Case ─────────────────────────────────────────────────────────────────
class GetDaySummaryUseCase {
    constructor(bookingRepository, scheduleRepository, blockedDateRepository, barberRepository, businessRepository) {
        this.bookingRepository = bookingRepository;
        this.scheduleRepository = scheduleRepository;
        this.blockedDateRepository = blockedDateRepository;
        this.barberRepository = barberRepository;
        this.businessRepository = businessRepository;
    }
    async execute(businessId, fecha) {
        const business = await this.businessRepository.findById(businessId);
        if (!business)
            throw new errors_1.NotFoundError("Negocio");
        const diaSemana = this.parseDiaSemana(fecha);
        const [bookings, schedules, blockedDates, barbers] = await Promise.all([
            this.bookingRepository.findByBusinessAndDate(businessId, fecha),
            this.scheduleRepository.findAllByBusiness(businessId),
            this.blockedDateRepository.findByBusiness(businessId),
            this.barberRepository.findByBusiness(businessId),
        ]);
        const activos = bookings.filter((b) => b.estado !== "cancelada");
        const buffer = business.buffer_minutos ?? 0;
        const ocupacion = this.calcularOcupacion(barbers, schedules, blockedDates, activos, diaSemana, fecha, buffer);
        const ingresoDia = activos.reduce((sum, b) => sum + (b.services?.precio ?? 0), 0);
        const primerTurnoLibre = this.calcularPrimerTurnoLibre(barbers, schedules, activos, diaSemana, fecha, buffer);
        const clientesNuevosHoy = await this.calcularClientesNuevos(businessId, fecha, activos);
        const resumenBarbers = this.buildBarberSummaries(barbers, schedules, blockedDates, activos, diaSemana, fecha);
        const esDiaNoLaborable = barbers.length > 0 && resumenBarbers.every((b) => !b.trabajaHoy);
        return {
            fecha,
            resumen: {
                totalTurnos: activos.length,
                cancelados: bookings.filter((b) => b.estado === "cancelada").length,
                pendientes: bookings.filter((b) => b.estado === "pendiente").length,
                confirmados: bookings.filter((b) => b.estado === "confirmada").length,
                ingresoDia,
                ocupacionPct: ocupacion.pct,
                primerTurnoLibre,
                clientesNuevosHoy,
                esDiaNoLaborable,
            },
            barbers: resumenBarbers,
        };
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    parseDiaSemana(fecha) {
        const [year, month, day] = fecha.split("-").map(Number);
        return new Date(year, month - 1, day).getDay();
    }
    parseMinutes(time) {
        const [h, m] = time.slice(0, 5).split(":").map(Number);
        return h * 60 + m;
    }
    minutesToTime(minutes) {
        const h = Math.floor(minutes / 60).toString().padStart(2, "0");
        const m = (minutes % 60).toString().padStart(2, "0");
        return `${h}:${m}`;
    }
    findScheduleForBarber(barberId, diaSemana, schedules) {
        return (schedules.find((s) => s.barber_id === barberId && s.dia_semana === diaSemana && s.activo) ??
            schedules.find((s) => s.barber_id === null && s.dia_semana === diaSemana && s.activo));
    }
    isBarberBlocked(barberId, fecha, blockedDates) {
        return blockedDates.some((bd) => {
            const matchesBusiness = bd.barber_id === null;
            const matchesBarber = bd.barber_id === barberId;
            if (!matchesBusiness && !matchesBarber)
                return false;
            return fecha >= bd.fecha && fecha <= (bd.fecha_fin ?? bd.fecha);
        });
    }
    calcularOcupacion(barbers, schedules, blockedDates, activos, diaSemana, fecha, buffer) {
        let totalSlots = 0;
        let ocupados = 0;
        for (const barber of barbers) {
            if (this.isBarberBlocked(barber.id, fecha, blockedDates))
                continue;
            const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
            if (!schedule)
                continue;
            const inicio = this.parseMinutes(schedule.hora_inicio);
            const fin = this.parseMinutes(schedule.hora_fin);
            const slotSize = GetDaySummaryUseCase.SLOT_SIZE_MINUTES;
            const slotsBarber = Math.floor((fin - inicio) / (slotSize + buffer));
            const bookingsBarber = activos.filter((b) => b.barber_id === barber.id).length;
            totalSlots += slotsBarber;
            ocupados += Math.min(bookingsBarber, slotsBarber);
        }
        const pct = totalSlots > 0 ? Math.round((ocupados / totalSlots) * 100) : 0;
        return { pct };
    }
    calcularPrimerTurnoLibre(barbers, schedules, activos, diaSemana, fecha, buffer) {
        const now = new Date();
        const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;
        const esHoy = fecha === now.toISOString().split("T")[0];
        let primerTurnoLibre = null;
        for (const barber of barbers) {
            const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
            if (!schedule)
                continue;
            const inicio = this.parseMinutes(schedule.hora_inicio);
            const fin = this.parseMinutes(schedule.hora_fin);
            const slotSize = GetDaySummaryUseCase.SLOT_SIZE_MINUTES;
            const horasOcupadas = activos
                .filter((b) => b.barber_id === barber.id)
                .map((b) => b.hora_inicio.slice(0, 5));
            for (let t = inicio; t + slotSize <= fin; t += slotSize + buffer) {
                const hora = this.minutesToTime(t);
                if (esHoy && hora <= horaActual)
                    continue;
                if (!horasOcupadas.includes(hora)) {
                    if (!primerTurnoLibre || hora < primerTurnoLibre) {
                        primerTurnoLibre = hora;
                    }
                    break;
                }
            }
        }
        return primerTurnoLibre;
    }
    async calcularClientesNuevos(businessId, fecha, activos) {
        const emailsHoy = [...new Set(activos.map((b) => b.cliente_email))];
        if (emailsHoy.length === 0)
            return 0;
        const emailsPrevios = await this.bookingRepository.findEmailsByBusiness(businessId, fecha, emailsHoy);
        const setPrevios = new Set(emailsPrevios);
        return emailsHoy.filter((e) => !setPrevios.has(e)).length;
    }
    buildBarberSummaries(barbers, schedules, blockedDates, activos, diaSemana, fecha) {
        return barbers.map((barber) => {
            const turnosBarber = activos.filter((b) => b.barber_id === barber.id).length;
            const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
            const trabajaHoy = !!schedule && !this.isBarberBlocked(barber.id, fecha, blockedDates);
            const ingreso = activos
                .filter((b) => b.barber_id === barber.id)
                .reduce((sum, b) => sum + (b.services?.precio ?? 0), 0);
            return {
                id: barber.id,
                nombre: barber.nombre,
                foto_url: barber.foto_url,
                trabajaHoy,
                turnos: turnosBarber,
                ingreso,
            };
        });
    }
}
exports.GetDaySummaryUseCase = GetDaySummaryUseCase;
GetDaySummaryUseCase.SLOT_SIZE_MINUTES = 30;
//# sourceMappingURL=GetDaySummaryUseCase.js.map