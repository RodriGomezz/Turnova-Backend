import { BookingRepository } from "../../infrastructure/database/BookingRepository";
import { ScheduleRepository } from "../../infrastructure/database/ScheduleRepository";
import { BlockedDateRepository } from "../../infrastructure/database/BlockedDateRepository";

interface GetAvailableSlotsInput {
  barberId: string;
  businessId: string;
  fecha: string;
  duracionMinutos: number;
  bufferMinutos: number;
}

interface TimeSlot {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

export class GetAvailableSlotsUseCase {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly blockedDateRepository: BlockedDateRepository,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    // Parsear fecha sin conversión de timezone — evita bugs de día incorrecto
    const [year, month, day] = input.fecha.split("-").map(Number);
    const diaSemana = new Date(year, month - 1, day).getDay() as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6;

    const isBlocked = await this.blockedDateRepository.isBlocked(
      input.businessId,
      input.barberId,
      input.fecha,
    );
    if (isBlocked) return [];

    const schedule = await this.scheduleRepository.findForBarber(
      input.businessId,
      input.barberId,
      diaSemana,
    );
    if (!schedule) return [];

    const existingBookings = await this.bookingRepository.findByBarberAndDate(
      input.barberId,
      input.fecha,
    );

    const slots = this.generateSlots(
      this.normalizeTime(schedule.hora_inicio),
      this.normalizeTime(schedule.hora_fin),
      input.duracionMinutos,
      input.bufferMinutos,
    );

    return slots.map((slot) => ({
      ...slot,
      disponible: !this.isSlotTaken(slot, existingBookings),
    }));
  }

  private normalizeTime(time: string): string {
    return time.slice(0, 5);
  }

  private generateSlots(
    horaInicio: string,
    horaFin: string,
    duracion: number,
    buffer: number,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
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
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
}
