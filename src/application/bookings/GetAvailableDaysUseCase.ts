import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { NotFoundError } from "../../domain/errors";
import { BlockedDate } from "../../domain/entities/BlockedDate";
import { Schedule } from "../../domain/entities/Schedule";
import { padRangesWithBuffer, MinuteRange } from "../../domain/booking-scheduling";

export interface GetAvailableDaysInput {
  slug: string;
  year: number;
  month: number;
  barberId: string;
  serviceId?: string;
}

export interface GetAvailableDaysResult {
  availableDays: string[];
  year: number;
  month: number;
}

export class GetAvailableDaysUseCase {
  constructor(
    private readonly businessRepository: IBusinessRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async execute(input: GetAvailableDaysInput): Promise<GetAvailableDaysResult> {
    const business = await this.businessRepository.findBySlug(input.slug);
    if (!business) throw new NotFoundError("Negocio");

    const service = input.serviceId
      ? await this.serviceRepository.findById(input.serviceId)
      : null;

    const duracion = service?.duracion_minutos ?? 30;
    const buffer = business.buffer_minutos ?? 0;
    // Ver comentario grande en generateCandidateStartMinutes: cada cuánto
    // se ofrece un horario de inicio, desacoplado de `duracion`.
    const intervalo = business.intervalo_turnos_minutos ?? 60;
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
      this.bookingRepository.findByBarberAndMonth(
        input.barberId,
        business.id,
        firstDay,
        lastDayStr,
      ),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diasAnticipacion = business.dias_anticipacion ?? 30;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + diasAnticipacion);

    const availableDays: string[] = [];

    for (let d = 1; d <= lastDayDate.getDate(); d++) {
      const date = new Date(y, m - 1, d);
      if (date < today || date > maxDate) continue;

      const dateStr = `${y}-${m.toString().padStart(2, "0")}-${d
        .toString()
        .padStart(2, "0")}`;

      if (this.isDateBlocked(dateStr, input.barberId, blockedDates)) continue;

      const schedule = schedules.find(
        (s) => s.dia_semana === date.getDay() && s.activo,
      );
      if (!schedule) continue;

      if (this.hasAvailableSlot(dateStr, schedule, existingBookings, duracion, buffer, intervalo)) {
        availableDays.push(dateStr);
      }
    }

    return { availableDays, year: y, month: m };
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private isDateBlocked(
    dateStr: string,
    barberId: string,
    blockedDates: BlockedDate[],
  ): boolean {
    return blockedDates.some((bd) => {
      const matchesBusiness = bd.barber_id === null;
      const matchesBarber = bd.barber_id === barberId;
      if (!matchesBusiness && !matchesBarber) return false;
      return dateStr >= bd.fecha && dateStr <= (bd.fecha_fin ?? bd.fecha);
    });
  }

  private hasAvailableSlot(
    dateStr: string,
    schedule: Schedule,
    existingBookings: Array<{ fecha: string; hora_inicio: string; hora_fin: string }>,
    duracion: number,
    buffer: number,
    intervalo: number,
  ): boolean {
    const inicio = this.parseMinutes(schedule.hora_inicio);
    const fin    = this.parseMinutes(schedule.hora_fin);
    const brkStart = schedule.break_start ? this.parseMinutes(schedule.break_start) : null;
    const brkEnd   = schedule.break_end   ? this.parseMinutes(schedule.break_end)   : null;

    // Pre-parsear bookings del día para no repetir el parsing en cada slot.
    // Padeadas ±buffer acá mismo — ver padRangesWithBuffer, misma lógica
    // que las otras rutas de slots (antes el buffer solo se respetaba de
    // forma indirecta a través del paso de la grilla).
    const bookingsDelDiaRaw: MinuteRange[] = existingBookings
      .filter((b) => b.fecha === dateStr)
      .map((b) => ({
        start: this.parseMinutes(b.hora_inicio),
        end:   this.parseMinutes(b.hora_fin),
      }));
    const bookingsDelDia = padRangesWithBuffer(bookingsDelDiaRaw, buffer);

    // Paso de grilla = intervalo configurado por el negocio, desacoplado
    // de `duracion` — ver comentario grande en generateCandidateStartMinutes.
    const paso = Math.max(intervalo, 1);
    for (let t = inicio; t + duracion <= fin; t += paso) {
      const slotStart = t;
      const slotEnd   = t + duracion;

      const overlapsBreak =
        brkStart !== null && brkEnd !== null &&
        slotStart < brkEnd && slotEnd > brkStart;
      if (overlapsBreak) continue;

      // Usar overlap de intervalos — igual que generateSlots en GetAllSlotsForDaysUseCase.
      // El enfoque anterior comparaba hora_inicio exacta y podía marcar como disponible
      // un día donde todos los slots reales están ocupados (si las horas no coincidían exacto).
      const ocupado = bookingsDelDia.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );
      if (!ocupado) return true;
    }

    return false;
  }

  private parseMinutes(time: string): number {
    const normalized = time.slice(0, 5);
    const [h, m] = normalized.split(":").map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
}
