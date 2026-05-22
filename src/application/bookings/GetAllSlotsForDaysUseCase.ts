/**
 * GetAllSlotsForDaysUseCase
 *
 * Precarga en paralelo los slots de TODOS los días disponibles del mes de una
 * vez. El frontend puede mostrar el calendario y, cuando el usuario toca un
 * día, los slots ya están en caché del cliente → cero latencia percibida.
 *
 * ── ¿Por qué este enfoque? ──────────────────────────────────────────────────
 * El flujo anterior:
 *   1. GET /available-days  → calcula qué días tienen slots  (1 req)
 *   2. Usuario toca día A   → GET /slots?fecha=A             (1 req + latencia)
 *   3. Usuario cambia a B   → GET /slots?fecha=B             (1 req + latencia)
 *
 * El nuevo flujo:
 *   1. GET /available-days-with-slots → días + slots de todos en una llamada
 *   2. Usuario toca día A  → datos ya en memoria del cliente (0 req, 0 latencia)
 *   3. Usuario cambia a B  → ídem
 *
 * ── Costo real en BD ────────────────────────────────────────────────────────
 * GetAvailableDaysUseCase ya carga TODO el mes en 3 queries (schedules,
 * blockedDates, bookings) y las procesa en memoria. Este use case reutiliza
 * exactamente esa lógica y además genera los slots en proceso, sin queries
 * adicionales a la BD.
 *
 * ── Tamaño de payload ───────────────────────────────────────────────────────
 * Un mes con 22 días hábiles × ~16 slots/día × ~60 bytes/slot = ~21 KB JSON.
 * Insignificante para el cliente; se puede comprimir con gzip (Express lo hace
 * automáticamente si el cliente envía Accept-Encoding: gzip).
 */

import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { NotFoundError } from "../../domain/errors";
import { BlockedDate } from "../../domain/entities/BlockedDate";
import { Schedule } from "../../domain/entities/Schedule";

export interface TimeSlot {
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

export interface DaySlots {
  fecha: string;
  slots: TimeSlot[];
}

export interface GetAllSlotsForDaysInput {
  slug: string;
  year: number;
  month: number;
  barberId: string;
  serviceId?: string;
  excludeBookingId?: string;
}

export interface GetAllSlotsForDaysResult {
  year: number;
  month: number;
  /** Mapa fecha → slots, solo para días con al menos un slot disponible */
  days: DaySlots[];
}

export class GetAllSlotsForDaysUseCase {
  constructor(
    private readonly businessRepository: IBusinessRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async execute(input: GetAllSlotsForDaysInput): Promise<GetAllSlotsForDaysResult> {
    const business = await this.businessRepository.findBySlug(input.slug);
    if (!business) throw new NotFoundError("Negocio");

    const service = input.serviceId
      ? await this.serviceRepository.findById(input.serviceId)
      : null;

    const duracion = service?.duracion_minutos ?? 30;
    const buffer   = business.buffer_minutos ?? 0;
    const { year: y, month: m } = input;

    const lastDayDate = new Date(y, m, 0);
    const lastDay     = lastDayDate.getDate();
    const pad         = (n: number) => n.toString().padStart(2, "0");
    const firstDayStr = `${y}-${pad(m)}-01`;
    const lastDayStr  = `${y}-${pad(m)}-${pad(lastDay)}`;

    // ── 3 queries al total, igual que GetAvailableDaysUseCase ────────────────
    const [schedules, blockedDates, existingBookings] = await Promise.all([
      this.scheduleRepository.findAllByBusiness(business.id, input.barberId || undefined),
      this.blockedDateRepository.findByBusiness(business.id),
      this.bookingRepository.findByBarberAndMonth(
        input.barberId,
        business.id,
        firstDayStr,
        lastDayStr,
      ),
    ]);
    const bookings = input.excludeBookingId
      ? existingBookings.filter((booking) => booking.id !== input.excludeBookingId)
      : existingBookings;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (business.dias_anticipacion ?? 30));

    const days: DaySlots[] = [];

    for (let d = 1; d <= lastDay; d++) {
      const date    = new Date(y, m - 1, d);
      const dateStr = `${y}-${pad(m)}-${pad(d)}`;

      if (date < today || date > maxDate) continue;
      if (this.isDateBlocked(dateStr, input.barberId, blockedDates)) continue;

      const schedule = schedules.find(
        (s) => s.dia_semana === date.getDay() && s.activo,
      );
      if (!schedule) continue;

      const bookingsDelDia = bookings.filter((b) => b.fecha === dateStr);
      const slots = this.generateSlots(
        schedule.hora_inicio,
        schedule.hora_fin,
        duracion,
        buffer,
        bookingsDelDia,
      );

      // Solo incluir días con al menos un slot libre
      if (slots.some((s) => s.disponible)) {
        days.push({ fecha: dateStr, slots });
      }
    }

    return { year: y, month: m, days };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isDateBlocked(
    dateStr: string,
    barberId: string,
    blockedDates: BlockedDate[],
  ): boolean {
    return blockedDates.some((bd) => {
      const matchesBusiness = bd.barber_id === null;
      const matchesBarber   = bd.barber_id === barberId;
      if (!matchesBusiness && !matchesBarber) return false;
      return dateStr >= bd.fecha && dateStr <= (bd.fecha_fin ?? bd.fecha);
    });
  }

  private generateSlots(
    horaInicio: string,
    horaFin: string,
    duracion: number,
    buffer: number,
    bookings: Array<{ fecha: string; hora_inicio: string; hora_fin: string }>,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const end     = this.toMinutes(horaFin);
    let   current = this.toMinutes(horaInicio);

    while (current + duracion <= end) {
      const slotStart = current;
      const slotEnd   = current + duracion;

      const disponible = !bookings.some((b) => {
        const bStart = this.toMinutes(b.hora_inicio);
        const bEnd   = this.toMinutes(b.hora_fin);
        return slotStart < bEnd && slotEnd > bStart;
      });

      slots.push({
        hora_inicio: this.fromMinutes(slotStart),
        hora_fin:    this.fromMinutes(slotEnd),
        disponible,
      });
      current += duracion + buffer;
    }

    return slots;
  }

  private toMinutes(time: string): number {
    const [h, m] = time.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }

  private fromMinutes(minutes: number): string {
    return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
  }
}
