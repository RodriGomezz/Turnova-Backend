import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { computeActiveBlocks, activeBlocksCollide, BookingItemInput } from "../../domain/booking-scheduling";

export interface GetAvailableSlotsInput {
  barberId: string;
  businessId: string;
  fecha: string;
  duracionMinutos: number;
  bufferMinutos: number;
  excludeBookingId?: string;
  /**
   * Items del servicio/combo que se está por reservar, con sus fases
   * (aplicación / procesamiento / acabado). Si se omite, se asume un único
   * item activo de duracionMinutos completo (comportamiento actual, sin
   * fases) — así ningún llamador existente tiene que cambiar para seguir
   * funcionando igual que hoy.
   */
  items?: BookingItemInput[];
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
    private readonly barberRepository: IBarberRepository,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const diaSemana = this.parseDiaSemana(input.fecha);

    const [isBlocked, schedule, existingBookings, barber] = await Promise.all([
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
      this.barberRepository.findById(input.barberId),
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

    const capacidadSillas = barber?.capacidad_sillas ?? 1;

    if (capacidadSillas <= 1) {
      return slots.map((slot) => ({
        ...slot,
        disponible: !this.isSlotTaken(slot, bookings),
      }));
    }

    const activeBlocks = await this.bookingRepository.findActiveBlocksByBarberAndDate(
      input.barberId,
      input.fecha,
      input.excludeBookingId,
    );
    const activeBlocksMinutos = activeBlocks.map((b) => ({
      start: this.timeToMinutes(b.hora_inicio),
      end: this.timeToMinutes(b.hora_fin),
    }));

    const candidateItems: BookingItemInput[] =
      input.items ?? [{ orden: 0, duracion_minutos: input.duracionMinutos }];

    return slots.map((slot) => {
      const slotStart = this.timeToMinutes(slot.hora_inicio);
      const sillaLibre = this.haySillaLibre(slot, bookings, capacidadSillas);
      const barberoLibre = !activeBlocksCollide(slotStart, candidateItems, activeBlocksMinutos);
      return { ...slot, disponible: sillaLibre && barberoLibre };
    });
  }

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

  private haySillaLibre(
    slot: TimeSlot,
    bookings: Array<{ hora_inicio: string; hora_fin: string }>,
    capacidadSillas: number,
  ): boolean {
    const slotStart = this.timeToMinutes(slot.hora_inicio);
    const slotEnd = this.timeToMinutes(slot.hora_fin);

    const sillasOcupadas = bookings.filter((booking) => {
      const bookingStart = this.timeToMinutes(booking.hora_inicio);
      const bookingEnd = this.timeToMinutes(booking.hora_fin);
      return slotStart < bookingEnd && slotEnd > bookingStart;
    }).length;

    return sillasOcupadas < capacidadSillas;
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
