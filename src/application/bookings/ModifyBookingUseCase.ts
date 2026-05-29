import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { Booking } from "../../domain/entities/Booking";
import { AppError, NotFoundError, ConflictError } from "../../domain/errors";
import { invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";
import { logger } from "../../infrastructure/logger";

export interface ModifyBookingInput {
  bookingId:  string;
  businessId: string;
  fecha:      string;
  horaInicio: string;
  horaFin:    string;
  barberId?:  string;
  serviceId?: string;
}

export class ModifyBookingUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
  ) {}

  async execute(input: ModifyBookingInput): Promise<Booking> {
    const booking = await this.bookingRepository.findById(input.bookingId);

    if (!booking) throw new NotFoundError("Reserva");
    if (booking.business_id !== input.businessId) throw new AppError("Sin acceso", 403);
    if (booking.estado === "cancelada") {
      throw new AppError("No se puede modificar una reserva cancelada", 400);
    }
    if (booking.fecha < this.todayString()) {
      throw new AppError("Solo se pueden modificar reservas de hoy en adelante", 400);
    }
    if (input.fecha < this.todayString()) {
      throw new AppError("No se puede mover una reserva a una fecha pasada", 400);
    }

    const targetBarberId = input.barberId ?? booking.barber_id;

    // Parsear como fecha local para evitar el bug de timezone UTC.
    // new Date("2025-01-15") se interpreta como UTC midnight y en TZ=America/Montevideo
    // (-03:00) getDay() devuelve el día anterior. El constructor con partes numéricas
    // siempre crea una fecha en hora local del servidor.
    const [fechaYear, fechaMonth, fechaDay] = input.fecha.split("-").map(Number);
    const diaSemana = new Date(fechaYear, fechaMonth - 1, fechaDay).getDay() as
      | 0 | 1 | 2 | 3 | 4 | 5 | 6;

    // Verificar que el nuevo slot está disponible
    const [isBlocked, schedule, existingBookings] = await Promise.all([
      this.blockedDateRepository.isBlocked(input.businessId, targetBarberId, input.fecha),
      this.scheduleRepository.findForBarber(
        input.businessId,
        targetBarberId,
        diaSemana,
      ),
      this.bookingRepository.findByBarberAndDate(targetBarberId, input.fecha),
    ]);

    if (isBlocked) throw new AppError("El profesional no trabaja ese día", 400);
    if (!schedule)  throw new AppError("No hay horario configurado para ese día", 400);

    const startMin = this.toMin(input.horaInicio);
    const endMin   = this.toMin(input.horaFin);

    // Verificar colisión — excluir la misma reserva que se está modificando
    const collision = existingBookings.some((b) => {
      if (b.id === input.bookingId) return false;
      if (b.estado === "cancelada")  return false;
      const bStart = this.toMin(b.hora_inicio);
      const bEnd   = this.toMin(b.hora_fin);
      return startMin < bEnd && endMin > bStart;
    });

    if (collision) {
      throw new ConflictError("El horario seleccionado ya está ocupado");
    }

    const updated = await this.bookingRepository.modify(input.bookingId, {
      fecha:       input.fecha,
      hora_inicio: input.horaInicio,
      hora_fin:    input.horaFin,
      barber_id:   targetBarberId,
      service_id:  input.serviceId ?? booking.service_id,
      estado:      booking.estado === "confirmada" ? "confirmada" : "pendiente",
      modified_at: new Date().toISOString(),
    });

    invalidateSlotsCache(input.businessId);

    logger.info("Reserva modificada", {
      bookingId:     input.bookingId,
      businessId:    input.businessId,
      fechaAnterior: booking.fecha,
      fechaNueva:    input.fecha,
      horaAnterior:  booking.hora_inicio,
      horaNueva:     input.horaInicio,
      barberId:      targetBarberId,
    });

    return updated;
  }

  private toMin(time: string): number {
    const [h, m] = time.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }

  private todayString(): string {
    // toISOString() devuelve UTC — a las 22:00 de Uruguay (UTC-3) el servidor
    // ya marca mañana y bloquea modificaciones de reservas de hoy.
    // Usamos las partes locales del Date para obtener la fecha correcta.
    const now = new Date();
    return (
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0")
    );
  }
}