import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { NotFoundError } from "../../domain/errors";
import { BlockedDate } from "../../domain/entities/BlockedDate";
import { Schedule } from "../../domain/entities/Schedule";

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
  /** Días máximos hacia adelante que se permiten reservar */
  private static readonly MAX_DAYS_AHEAD = 7;

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
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + GetAvailableDaysUseCase.MAX_DAYS_AHEAD);

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

      if (this.hasAvailableSlot(dateStr, schedule, existingBookings, duracion, buffer)) {
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
  ): boolean {
    const inicio = this.parseMinutes(schedule.hora_inicio);
    const fin = this.parseMinutes(schedule.hora_fin);
    const bookingsDelDia = existingBookings.filter((b) => b.fecha === dateStr);

    for (let t = inicio; t + duracion <= fin; t += duracion + buffer) {
      const hora = this.minutesToTime(t);
      const ocupado = bookingsDelDia.some(
        (b) => b.hora_inicio.slice(0, 5) === hora,
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
