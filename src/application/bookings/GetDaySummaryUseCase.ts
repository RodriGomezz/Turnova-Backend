import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { NotFoundError } from "../../domain/errors";
import { Barber } from "../../domain/entities/Barber";
import { Booking } from "../../domain/entities/Booking";
import { Schedule } from "../../domain/entities/Schedule";
import { BlockedDate } from "../../domain/entities/BlockedDate";

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

interface BookingWithService extends Booking {
  services?: {
    precio: number;
  } | null;
}

// ── Use Case ─────────────────────────────────────────────────────────────────

export class GetDaySummaryUseCase {
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
      (b): b is BookingWithService => b.estado !== "cancelada",
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
      (sum, b) => sum + ((b as BookingWithService).services?.precio ?? 0),
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

  private calcularOcupacion(
    barbers: Barber[],
    schedules: Schedule[],
    blockedDates: BlockedDate[],
    activos: BookingWithService[],
    diaSemana: number,
    fecha: string,
    buffer: number,
  ): { pct: number } {
    let totalSlots = 0;
    let ocupados = 0;

    for (const barber of barbers) {
      if (this.isBarberBlocked(barber.id, fecha, blockedDates)) continue;

      const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
      if (!schedule) continue;

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

  private calcularPrimerTurnoLibre(
    barbers: Barber[],
    schedules: Schedule[],
    activos: BookingWithService[],
    diaSemana: number,
    fecha: string,
    buffer: number,
  ): string | null {
    const now = new Date();
    const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const esHoy = fecha === now.toISOString().split("T")[0];

    let primerTurnoLibre: string | null = null;

    for (const barber of barbers) {
      const schedule = this.findScheduleForBarber(barber.id, diaSemana, schedules);
      if (!schedule) continue;

      const inicio = this.parseMinutes(schedule.hora_inicio);
      const fin = this.parseMinutes(schedule.hora_fin);
      const slotSize = GetDaySummaryUseCase.SLOT_SIZE_MINUTES;

      const horasOcupadas = activos
        .filter((b) => b.barber_id === barber.id)
        .map((b) => b.hora_inicio.slice(0, 5));

      for (let t = inicio; t + slotSize <= fin; t += slotSize + buffer) {
        const hora = this.minutesToTime(t);
        if (esHoy && hora <= horaActual) continue;
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

  private async calcularClientesNuevos(
    businessId: string,
    fecha: string,
    activos: BookingWithService[],
  ): Promise<number> {
    const emailsHoy = [...new Set(activos.map((b) => b.cliente_email))];
    if (emailsHoy.length === 0) return 0;

    const emailsPrevios = await this.bookingRepository.findEmailsByBusiness(
      businessId,
      fecha,
      emailsHoy,
    );
    const setPrevios = new Set(emailsPrevios);
    return emailsHoy.filter((e) => !setPrevios.has(e)).length;
  }

  private buildBarberSummaries(
    barbers: Barber[],
    schedules: Schedule[],
    blockedDates: BlockedDate[],
    activos: BookingWithService[],
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
