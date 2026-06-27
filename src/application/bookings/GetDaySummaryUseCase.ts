import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { NotFoundError } from "../../domain/errors";
import { Barber } from "../../domain/entities/Barber";
import { Booking, BookingItem } from "../../domain/entities/Booking";
import { Schedule } from "../../domain/entities/Schedule";
import { BlockedDate } from "../../domain/entities/BlockedDate";
import { sumPrecioItems, sumDuracionItems } from "../../domain/booking-pricing";

// ── Tipos de salida ──────────────────────────────────────────────────────────

export interface BarberDaySummary {
  id: string;
  nombre: string;
  foto_url: string | null;
  trabajaHoy: boolean;
  turnos: number;
  ingreso: number;
}

export interface DaySummaryResult {
  fecha: string;
  resumen: {
    totalTurnos: number;
    cancelados: number;
    pendientes: number;
    confirmados: number;
    ingresoDia: number;
    ocupacionPct: number;
    primerTurnoLibre: string | null;
    clientesNuevosHoy: number;
    esDiaNoLaborable: boolean;
  };
  barbers: BarberDaySummary[];
}

// ── Tipos internos (sin any) ─────────────────────────────────────────────────

interface BookingWithItems extends Booking {
  booking_items?: BookingItem[] | null;
}

// ── Use Case ─────────────────────────────────────────────────────────────────

export class GetDaySummaryUseCase {
  // Slot por defecto para turnos sin booking_items (no debería pasar en
  // datos nuevos — solo cubre el caso defensivo de una reserva sin items
  // por un fallo de datos). El cálculo real usa sumDuracionItems(booking).
  private static readonly SLOT_SIZE_MINUTES = 30;

  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
    private readonly barberRepository: IBarberRepository,
    private readonly businessRepository: IBusinessRepository,
  ) {}

  async execute(businessId: string, fecha: string): Promise<DaySummaryResult> {
    const business = await this.businessRepository.findById(businessId);
    if (!business) throw new NotFoundError("Negocio");

    const diaSemana = this.parseDiaSemana(fecha);

    const [bookings, schedules, blockedDates, barbers] = await Promise.all([
      this.bookingRepository.findByBusinessAndDate(businessId, fecha),
      this.scheduleRepository.findAllByBusiness(businessId),
      this.blockedDateRepository.findByBusiness(businessId),
      this.barberRepository.findByBusiness(businessId),
    ]);

    const activos = bookings.filter(
      (b): b is BookingWithItems => b.estado !== "cancelada",
    );
    const buffer = business.buffer_minutos ?? 0;

    const ocupacion = this.calcularOcupacion(
      barbers,
      schedules,
      blockedDates,
      activos,
      diaSemana,
      fecha,
      buffer,
    );

    const ingresoDia = activos.reduce(
      (sum, b) => sum + sumPrecioItems(b.booking_items),
      0,
    );

    const primerTurnoLibre = this.calcularPrimerTurnoLibre(
      barbers,
      schedules,
      activos,
      diaSemana,
      fecha,
      buffer,
    );

    const clientesNuevosHoy = await this.calcularClientesNuevos(
      businessId,
      fecha,
      activos,
    );

    const resumenBarbers = this.buildBarberSummaries(
      barbers,
      schedules,
      blockedDates,
      activos,
      diaSemana,
      fecha,
    );

    const esDiaNoLaborable =
      barbers.length > 0 && resumenBarbers.every((b) => !b.trabajaHoy);

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

  private parseDiaSemana(fecha: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
    const [year, month, day] = fecha.split("-").map(Number);
    return new Date(year, month - 1, day).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  }

  private parseMinutes(time: string): number {
    const [h, m] = time.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  /** Duración real de un booking según sus items; si no tiene items registrados, cae al slot por defecto. */
  private duracionReal(booking: BookingWithItems): number {
    const real = sumDuracionItems(booking.booking_items);
    return real > 0 ? real : GetDaySummaryUseCase.SLOT_SIZE_MINUTES;
  }

  private findScheduleForBarber(
    barberId: string,
    diaSemana: number,
    schedules: Schedule[],
  ): Schedule | undefined {
    return (
      schedules.find(
        (s) => s.barber_id === barberId && s.dia_semana === diaSemana && s.activo,
      ) ??
      schedules.find(
        (s) => s.barber_id === null && s.dia_semana === diaSemana && s.activo,
      )
    );
  }

  private isBarberBlocked(
    barberId: string,
    fecha: string,
    blockedDates: BlockedDate[],
  ): boolean {
    return blockedDates.some((bd) => {
      const matchesBusiness = bd.barber_id === null;
      const matchesBarber = bd.barber_id === barberId;
      if (!matchesBusiness && !matchesBarber) return false;
      return fecha >= bd.fecha && fecha <= (bd.fecha_fin ?? bd.fecha);
    });
  }

  /**
   * Ocupación real: en vez de contar "turnos vs. slots de 30 min", suma los
   * minutos efectivamente reservados (duración real de cada booking según
   * sus items, ya que un combo puede durar más que un slot fijo) contra los
   * minutos disponibles en el horario del profesional. Antes, un combo de
   * 90 minutos contaba como "1 turno" igual que un corte de 30 — subestimaba
   * la ocupación real de la agenda en negocios con servicios largos o combos.
   */
  private calcularOcupacion(
    barbers: Barber[],
    schedules: Schedule[],
    blockedDates: BlockedDate[],
    activos: BookingWithItems[],
    diaSemana: number,
    fecha: string,
    buffer: number,
  ): { pct: number } {
    let minutosDisponibles = 0;
    let minutosOcupados = 0;

    for (const barber of barbers) {
      if (this.isBarberBlocked(barber.id, fecha, blockedDates)) continue;

      const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
      if (!schedule) continue;

      const inicio = this.parseMinutes(schedule.hora_inicio);
      const fin = this.parseMinutes(schedule.hora_fin);

      const bookingsBarber = activos.filter((b) => b.barber_id === barber.id);
      const minutosReservados = bookingsBarber.reduce(
        (sum, b) => sum + this.duracionReal(b) + buffer,
        0,
      );

      minutosDisponibles += Math.max(fin - inicio, 0);
      // No puede superar el horario disponible del día (turnos que se
      // extendieron por un agregado in-situ no deben inflar el % por sí solos).
      minutosOcupados += Math.min(minutosReservados, Math.max(fin - inicio, 0));
    }

    const pct =
      minutosDisponibles > 0 ? Math.round((minutosOcupados / minutosDisponibles) * 100) : 0;
    return { pct };
  }

  private calcularPrimerTurnoLibre(
    barbers: Barber[],
    schedules: Schedule[],
    activos: BookingWithItems[],
    diaSemana: number,
    fecha: string,
    buffer: number,
  ): string | null {
    const now = new Date();
    const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const esHoy = fecha === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    let primerTurnoLibre: string | null = null;

    for (const barber of barbers) {
      const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
      if (!schedule) continue;

      const inicio = this.parseMinutes(schedule.hora_inicio);
      const fin = this.parseMinutes(schedule.hora_fin);

      // Intervalos [inicio, fin) realmente ocupados por cada booking del
      // barbero, usando su duración real — no un slot fijo. Así un combo
      // largo bloquea correctamente todo el rango de minutos que ocupa,
      // en vez de liberar minutos que en realidad están tomados.
      const intervalosOcupados = activos
        .filter((b) => b.barber_id === barber.id)
        .map((b) => {
          const start = this.parseMinutes(b.hora_inicio);
          return { start, end: start + this.duracionReal(b) };
        });

      const probeStep = 5; // resolución de búsqueda del próximo hueco libre
      for (let t = inicio; t < fin; t += probeStep) {
        const hora = this.minutesToTime(t);
        if (esHoy && hora <= horaActual) continue;

        const ocupado = intervalosOcupados.some(
          (iv) => t >= iv.start && t < iv.end + buffer,
        );
        if (!ocupado) {
          if (!primerTurnoLibre || hora < primerTurnoLibre) {
            primerTurnoLibre = hora;
          }
          break;
        }
      }
    }

    return primerTurnoLibre;
  }

  private async calcularClientesNuevos(
    businessId: string,
    fecha: string,
    activos: BookingWithItems[],
  ): Promise<number> {
    const emailsHoy = [...new Set(activos.map((b) => b.cliente_email))];
    const phonesHoy = [...new Set(activos.map((b) => b.cliente_telefono))];
    if (emailsHoy.length === 0 && phonesHoy.length === 0) return 0;

    const previousClients = await this.bookingRepository.findPreviousClientMatchesByBusiness(
      businessId,
      fecha,
      emailsHoy,
      phonesHoy,
    );
    const previousEmailSet = new Set(previousClients.map((client: { cliente_email: string; cliente_telefono: string }) => client.cliente_email));
    const previousPhoneSet = new Set(previousClients.map((client: { cliente_email: string; cliente_telefono: string }) => client.cliente_telefono));

    return activos.filter((booking, index, array) => {
      const firstMatchIndex = array.findIndex(
        (candidate) =>
          candidate.cliente_email === booking.cliente_email &&
          candidate.cliente_telefono === booking.cliente_telefono,
      );
      if (firstMatchIndex !== index) return false;

      return (
        !previousEmailSet.has(booking.cliente_email) &&
        !previousPhoneSet.has(booking.cliente_telefono)
      );
    }).length;
  }

  private buildBarberSummaries(
    barbers: Barber[],
    schedules: Schedule[],
    blockedDates: BlockedDate[],
    activos: BookingWithItems[],
    diaSemana: number,
    fecha: string,
  ): BarberDaySummary[] {
    return barbers.map((barber) => {
      const turnosBarber = activos.filter((b) => b.barber_id === barber.id).length;
      const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
      const trabajaHoy =
        !!schedule && !this.isBarberBlocked(barber.id, fecha, blockedDates);

      const ingreso = activos
        .filter((b) => b.barber_id === barber.id)
        .reduce((sum, b) => sum + sumPrecioItems(b.booking_items), 0);

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
