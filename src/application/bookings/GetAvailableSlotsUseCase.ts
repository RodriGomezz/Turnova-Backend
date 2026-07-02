import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";

export interface GetAvailableSlotsInput {
  barberId: string;
  businessId: string;
  fecha: string;
  duracionMinutos: number;
  bufferMinutos: number;
  excludeBookingId?: string;
}

export interface TimeSlot {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export class GetAvailableSlotsUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const diaSemana = this.parseDiaSemana(input.fecha);

    // PERF-001: las 3 queries son independientes — se lanzan en paralelo.
    // Antes: ~60ms en serie. Ahora: ~20ms (el más lento de los 3).
    const [isBlocked, schedule, existingBookings] = await Promise.all([
      this.blockedDateRepository.isBlocked(
        input.businessId,
        input.barberId,
        input.fecha,
      ),
      this.scheduleRepository.findForBarber(
        input.businessId,
        input.barberId,
        diaSemana,
      ),
      this.bookingRepository.findByBarberAndDate(
        input.barberId,
        input.fecha,
      ),
    ]);

    if (isBlocked || !schedule) return [];
    const bookings = input.excludeBookingId
      ? existingBookings.filter((booking) => booking.id !== input.excludeBookingId)
      : existingBookings;

    const slots = this.generateSlots(
      this.normalizeTime(schedule.hora_inicio),
      this.normalizeTime(schedule.hora_fin),
      input.duracionMinutos,
      input.bufferMinutos,
      schedule.break_start ? this.normalizeTime(schedule.break_start) : null,
      schedule.break_end   ? this.normalizeTime(schedule.break_end)   : null,
    );

    return slots.map((slot) => ({
      ...slot,
      disponible: !this.isSlotTaken(slot, bookings),
    }));
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Parsea la fecha como fecha local para evitar bugs de timezone.
   * "2025-01-15" → Date(2025, 0, 15) → .getDay()
   */
  private parseDiaSemana(fecha: string): DiaSemana {
    const [year, month, day] = fecha.split("-").map(Number);
    return new Date(year, month - 1, day).getDay() as DiaSemana;
  }

  private normalizeTime(time: string): string {
    return time.slice(0, 5);
  }

  private generateSlots(
    horaInicio: string,
    horaFin: string,
    duracion: number,
    buffer: number,
    breakStart: string | null = null,
    breakEnd: string | null = null,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const endMinutes = this.timeToMinutes(horaFin);
    const brkStart = breakStart ? this.timeToMinutes(breakStart) : null;
    const brkEnd   = breakEnd   ? this.timeToMinutes(breakEnd)   : null;
    let current = this.timeToMinutes(horaInicio);

    while (current + duracion <= endMinutes) {
      const slotEnd = current + duracion;

      // Si el slot solapa el descanso, saltar directo al fin del descanso
      const overlapsBreak =
        brkStart !== null && brkEnd !== null &&
        current < brkEnd && slotEnd > brkStart;

      if (overlapsBreak) {
        current = brkEnd!;
        continue;
      }

      slots.push({
        hora_inicio: this.minutesToTime(current),
        hora_fin: this.minutesToTime(slotEnd),
        disponible: true,
      });
      current += duracion + buffer;
    }

    return slots;
  }

  private isSlotTaken(
    slot: TimeSlot,
    bookings: Array<{ hora_inicio: string; hora_fin: string }>,
  ): boolean {
    const slotStart = this.timeToMinutes(slot.hora_inicio);
    const slotEnd = this.timeToMinutes(slot.hora_fin);

    return bookings.some((booking) => {
      const bookingStart = this.timeToMinutes(booking.hora_inicio);
      const bookingEnd = this.timeToMinutes(booking.hora_fin);
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
}
