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
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { NotFoundError } from "../../domain/errors";
import { BlockedDate } from "../../domain/entities/BlockedDate";
import { Schedule } from "../../domain/entities/Schedule";
import { BookingItemInput, isSlotDisponible, generateCandidateStartMinutes, padRangesWithBuffer, MinuteRange } from "../../domain/booking-scheduling";

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
  /** Uno o más servicios del combo elegido. La duración total es la suma de todos. */
  serviceIds?: string[];
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
    private readonly barberRepository: IBarberRepository,
  ) {}

  async execute(input: GetAllSlotsForDaysInput): Promise<GetAllSlotsForDaysResult> {
    const business = await this.businessRepository.findBySlug(input.slug);
    if (!business) throw new NotFoundError("Negocio");

    const services = input.serviceIds?.length
      ? await this.serviceRepository.findByIds(input.serviceIds)
      : [];

    // Suma de TODOS los servicios del combo — antes solo se tomaba un único
    // service_id y, si no llegaba (ej. el front manda service_ids plural),
    // se caía siempre al default de 30 min, generando un grid de horarios
    // que no coincidía con la duración real usada al crear la reserva.
    const duracion = services.length > 0
      ? services.reduce((sum, s) => sum + s.duracion_minutos, 0)
      : 30;
    const buffer   = business.buffer_minutos ?? 0;
    // Ver comentario grande en generateCandidateStartMinutes: cada cuánto
    // se ofrece un horario de inicio, desacoplado de `duracion`.
    const intervalo = business.intervalo_turnos_minutos ?? 60;
    const { year: y, month: m } = input;

    const lastDayDate = new Date(y, m, 0);
    const lastDay     = lastDayDate.getDate();
    const pad         = (n: number) => n.toString().padStart(2, "0");
    const firstDayStr = `${y}-${pad(m)}-01`;
    const lastDayStr  = `${y}-${pad(m)}-${pad(lastDay)}`;

    // ── 3 queries al total, igual que GetAvailableDaysUseCase ────────────────
    const [schedules, blockedDates, existingBookings, barber] = await Promise.all([
      this.scheduleRepository.findAllByBusiness(business.id, input.barberId || undefined),
      this.blockedDateRepository.findByBusiness(business.id),
      this.bookingRepository.findByBarberAndMonth(
        input.barberId,
        business.id,
        firstDayStr,
        lastDayStr,
      ),
      this.barberRepository.findById(input.barberId),
    ]);
    const bookings = input.excludeBookingId
      ? existingBookings.filter((booking) => booking.id !== input.excludeBookingId)
      : existingBookings;

    // capacidadSillas <= 1 (default, todo barbero preexistente): sigue el
    // camino simple de siempre, sin la query extra de abajo. Solo el
    // barbero que tenga capacidad_sillas > 1 configurada paga el costo de
    // traer bloques activos — igual que ya hace GetAvailableSlotsUseCase
    // para el buscador de un solo día. Ver isSlotDisponible en
    // domain/booking-scheduling.ts: es la misma función que usa esa otra
    // ruta, para que las dos no puedan volver a divergir.
    const capacidadSillas = barber?.capacidad_sillas ?? 1;

    const activeBlocksByFecha = new Map<string, MinuteRange[]>();
    if (capacidadSillas > 1) {
      const activeBlocks = await this.bookingRepository.findActiveBlocksByBarberAndMonth(
        input.barberId,
        firstDayStr,
        lastDayStr,
        input.excludeBookingId,
      );
      for (const b of activeBlocks) {
        const range: MinuteRange = { start: this.toMinutes(b.hora_inicio), end: this.toMinutes(b.hora_fin) };
        const list = activeBlocksByFecha.get(b.fecha) ?? [];
        list.push(range);
        activeBlocksByFecha.set(b.fecha, list);
      }
    }

    // Mismo criterio que BookingController al armar los items para crear la
    // reserva: cada servicio elegido, en el orden en que el cliente los
    // seleccionó, con sus fases (aplicación/procesamiento) tal como están
    // guardadas en el catálogo hoy. Si no hay servicios (calendario inicial
    // sin combo elegido todavía), un item genérico de `duracion` (30 min
    // default) sin fases — capacidadSillas<=1 ni siquiera llega a usar esto.
    const candidateItems: BookingItemInput[] = services.length > 0
      ? services.map((s, index) => ({
          orden: index,
          duracion_minutos: s.duracion_minutos,
          tiempo_activo_inicial_minutos: s.tiempo_activo_inicial_minutos,
          tiempo_procesamiento_minutos: s.tiempo_procesamiento_minutos,
        }))
      : [{ orden: 0, duracion_minutos: duracion }];

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
      const activeBlocksDelDia = activeBlocksByFecha.get(dateStr) ?? [];
      const slots = this.generateSlots(
        schedule.hora_inicio,
        schedule.hora_fin,
        duracion,
        buffer,
        intervalo,
        bookingsDelDia,
        capacidadSillas,
        candidateItems,
        activeBlocksDelDia,
        schedule.break_start,
        schedule.break_end,
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
    intervalo: number,
    bookings: Array<{ fecha: string; hora_inicio: string; hora_fin: string }>,
    capacidadSillas: number,
    candidateItems: BookingItemInput[],
    activeBlocksDelDia: MinuteRange[],
    breakStart: string | null = null,
    breakEnd: string | null = null,
  ): TimeSlot[] {
    const horaInicioMin = this.toMinutes(horaInicio);
    const horaFinMin    = this.toMinutes(horaFin);
    const brkStart = breakStart ? this.toMinutes(breakStart) : null;
    const brkEnd   = breakEnd   ? this.toMinutes(breakEnd)   : null;

    const bookingRangesRaw: MinuteRange[] = bookings.map((b) => ({
      start: this.toMinutes(b.hora_inicio),
      end: this.toMinutes(b.hora_fin),
    }));
    // Padeado ±buffer: única fuente de verdad del colchón entre turnos
    // ahora que el paso de la grilla ya no lo aplica implícitamente (ver
    // padRangesWithBuffer en booking-scheduling.ts).
    const bookingRanges = padRangesWithBuffer(bookingRangesRaw, buffer);

    // generateCandidateStartMinutes agrega, sobre la grilla fija de paso
    // `intervalo` (desacoplada de `duracion` — ver su comentario grande),
    // dos tipos de candidato extra: el fin real de cada reserva del día
    // (gap-filling — sin esto, un turno corto metido en un slot de la
    // grilla deja un hueco que la grilla fija nunca vuelve a ofrecer) y el
    // fin de cada bloque activo existente (para capacidadSillas > 1 — el
    // barbero se libera para la otra silla antes de que termine la
    // reserva completa).
    const candidateStarts = generateCandidateStartMinutes(
      horaInicioMin,
      horaFinMin,
      duracion,
      intervalo,
      capacidadSillas,
      activeBlocksDelDia,
      bookingRangesRaw.map((b) => b.end),
    );

    const slots: TimeSlot[] = [];
    for (const slotStart of candidateStarts) {
      const slotEnd = slotStart + duracion;

      const overlapsBreak =
        brkStart !== null && brkEnd !== null &&
        slotStart < brkEnd && slotEnd > brkStart;
      if (overlapsBreak) continue;

      const disponible = isSlotDisponible(
        slotStart,
        slotEnd,
        bookingRanges,
        capacidadSillas,
        candidateItems,
        activeBlocksDelDia,
      );

      slots.push({
        hora_inicio: this.fromMinutes(slotStart),
        hora_fin:    this.fromMinutes(slotEnd),
        disponible,
      });
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
