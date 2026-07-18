import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import {
  BookingItemInput,
  isSlotDisponible,
  generateCandidateStartMinutes,
  MinuteRange,
} from "../../domain/booking-scheduling";

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

    const capacidadSillas = barber?.capacidad_sillas ?? 1;

    const horaInicio = this.timeToMinutes(this.normalizeTime(schedule.hora_inicio));
    const horaFin    = this.timeToMinutes(this.normalizeTime(schedule.hora_fin));
    const brkStart = schedule.break_start ? this.timeToMinutes(this.normalizeTime(schedule.break_start)) : null;
    const brkEnd   = schedule.break_end   ? this.timeToMinutes(this.normalizeTime(schedule.break_end))   : null;

    const bookingRanges: MinuteRange[] = bookings.map((b) => ({
      start: this.timeToMinutes(b.hora_inicio),
      end: this.timeToMinutes(b.hora_fin),
    }));

    // Solo se paga la query de bloques activos cuando realmente hace falta
    // (capacidadSillas > 1) — mismo criterio de siempre, sin cambios para
    // el caso default.
    let activeBlocksMinutos: MinuteRange[] = [];
    if (capacidadSillas > 1) {
      const activeBlocks = await this.bookingRepository.findActiveBlocksByBarberAndDate(
        input.barberId,
        input.fecha,
        input.excludeBookingId,
      );
      activeBlocksMinutos = activeBlocks.map((b) => ({
        start: this.timeToMinutes(b.hora_inicio),
        end: this.timeToMinutes(b.hora_fin),
      }));
    }

    const candidateItems: BookingItemInput[] =
      input.items ?? [{ orden: 0, duracion_minutos: input.duracionMinutos }];

    const candidateStarts = generateCandidateStartMinutes(
      horaInicio,
      horaFin,
      input.duracionMinutos,
      input.bufferMinutos,
      capacidadSillas,
      activeBlocksMinutos,
    );

    const slots: TimeSlot[] = [];
    for (const start of candidateStarts) {
      const end = start + input.duracionMinutos;
      const overlapsBreak =
        brkStart !== null && brkEnd !== null && start < brkEnd && end > brkStart;
      if (overlapsBreak) continue;

      slots.push({
        hora_inicio: this.minutesToTime(start),
        hora_fin: this.minutesToTime(end),
        disponible: isSlotDisponible(
          start,
          end,
          bookingRanges,
          capacidadSillas,
          candidateItems,
          activeBlocksMinutos,
        ),
      });
    }

    return slots;
  }

  private parseDiaSemana(fecha: string): DiaSemana {
    const [year, month, day] = fecha.split("-").map(Number);
    return new Date(year, month - 1, day).getDay() as DiaSemana;
  }

  private normalizeTime(time: string): string {
    return time.slice(0, 5);
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
