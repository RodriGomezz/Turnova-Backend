import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";
import { IBlockedDateRepository } from "../../domain/interfaces/IBlockedDateRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { Booking } from "../../domain/entities/Booking";
import { Service } from "../../domain/entities/Service";
import { AppError, NotFoundError, ConflictError, ForbiddenError } from "../../domain/errors";
import { invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";
import { logger } from "../../infrastructure/logger";
import { activeBlocksCollide, BookingItemInput } from "../../domain/booking-scheduling";

export interface ModifyBookingInput {
  bookingId:  string;
  businessId: string;
  fecha:      string;
  horaInicio: string;
  horaFin:    string;
  barberId?:  string;
  /** @deprecated Usar serviceIds — se mantiene mientras el panel viejo lo siga mandando. */
  serviceId?: string;
  /**
   * Si se pasa, reemplaza el combo completo de servicios de la reserva
   * (no solo cambia fecha/hora/barbero). horaFin se recalcula a partir de
   * la suma de duraciones de estos servicios — el horaFin recibido en el
   * input se ignora en ese caso. Solo válido si la reserva todavía no
   * empezó (mismas reglas de fecha que el resto de este use case); para
   * agregar un servicio a una reserva en curso o ya pasada, usar
   * AddBookingItemUseCase en su lugar.
   */
  serviceIds?: string[];
}

export class ModifyBookingUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly scheduleRepository: IScheduleRepository,
    private readonly blockedDateRepository: IBlockedDateRepository,
    private readonly serviceRepository: IServiceRepository,
    private readonly barberRepository: IBarberRepository,
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

    // Si se reemplaza el combo de servicios, la duración total (y por lo
    // tanto hora_fin) depende de los nuevos servicios, no del horaFin que
    // vino en el input — se recalcula acá, antes de verificar colisión,
    // para que la verificación use el rango de tiempo real que va a ocupar.
    let nuevosServicios: Service[] = [];
    let horaFinEfectiva = input.horaFin;

    if (input.serviceIds?.length) {
      nuevosServicios = await this.serviceRepository.findByIds(input.serviceIds);
      if (nuevosServicios.length !== input.serviceIds.length) {
        throw new NotFoundError("Servicio");
      }
      if (nuevosServicios.some((s) => s.business_id !== input.businessId)) {
        throw new ForbiddenError();
      }
      const duracionTotal = nuevosServicios.reduce((sum, s) => sum + s.duracion_minutos, 0);
      horaFinEfectiva = this.sumarMinutos(input.horaInicio, duracionTotal);
    }

    // Parsear como fecha local para evitar el bug de timezone UTC.
    // new Date("2025-01-15") se interpreta como UTC midnight y en TZ=America/Montevideo
    // (-03:00) getDay() devuelve el día anterior. El constructor con partes numéricas
    // siempre crea una fecha en hora local del servidor.
    const [fechaYear, fechaMonth, fechaDay] = input.fecha.split("-").map(Number);
    const diaSemana = new Date(fechaYear, fechaMonth - 1, fechaDay).getDay() as
      | 0 | 1 | 2 | 3 | 4 | 5 | 6;

    // Verificar que el nuevo slot está disponible
    const [isBlocked, schedule, existingBookings, targetBarber] = await Promise.all([
      this.blockedDateRepository.isBlocked(input.businessId, targetBarberId, input.fecha),
      this.scheduleRepository.findForBarber(
        input.businessId,
        targetBarberId,
        diaSemana,
      ),
      this.bookingRepository.findByBarberAndDate(targetBarberId, input.fecha),
      this.barberRepository.findById(targetBarberId),
    ]);

    if (isBlocked) throw new AppError("El profesional no trabaja ese día", 400);
    if (!schedule)  throw new AppError("No hay horario configurado para ese día", 400);

    const startMin = this.toMin(input.horaInicio);
    const endMin   = this.toMin(horaFinEfectiva);
    const capacidadSillas = targetBarber?.capacidad_sillas ?? 1;

    // Otras reservas del mismo barbero ese día, sin contar la que se está modificando.
    const otras = existingBookings.filter(
      (b) => b.id !== input.bookingId && b.estado !== "cancelada",
    );

    let collision: boolean;

    if (capacidadSillas <= 1) {
      // Camino idéntico al de siempre: cualquier solapamiento de rango
      // completo es colisión. Cero cambio de comportamiento.
      collision = otras.some((b) => {
        const bStart = this.toMin(b.hora_inicio);
        const bEnd   = this.toMin(b.hora_fin);
        return startMin < bEnd && endMin > bStart;
      });
    } else {
      // Con más de una silla: hay colisión solo si (a) no queda silla libre
      // en todo el rango, o (b) el tiempo de atención activa del nuevo
      // combo choca con el de otra reserva — mismo criterio que
      // GetAvailableSlotsUseCase, necesario acá porque este use case no
      // pasa por ese buscador de slots (edita una reserva ya existente).
      const sillasOcupadas = otras.filter((b) => {
        const bStart = this.toMin(b.hora_inicio);
        const bEnd   = this.toMin(b.hora_fin);
        return startMin < bEnd && endMin > bStart;
      }).length;
      const sinSillaLibre = sillasOcupadas >= capacidadSillas;

      const itemsParaChequeo: BookingItemInput[] =
        nuevosServicios.length > 0
          ? nuevosServicios.map((s, index) => ({
              orden: index,
              duracion_minutos: s.duracion_minutos,
              tiempo_activo_inicial_minutos: s.tiempo_activo_inicial_minutos,
              tiempo_procesamiento_minutos: s.tiempo_procesamiento_minutos,
            }))
          : (await this.bookingRepository.findItemsByBookingId(booking.id)).map((it) => ({
              orden: it.orden,
              duracion_minutos: it.duracion_minutos,
              tiempo_activo_inicial_minutos: it.tiempo_activo_inicial_minutos,
              tiempo_procesamiento_minutos: it.tiempo_procesamiento_minutos,
            }));

      const activeBlocks = await this.bookingRepository.findActiveBlocksByBarberAndDate(
        targetBarberId,
        input.fecha,
        input.bookingId,
      );
      const activeBlocksMinutos = activeBlocks.map((b) => ({
        start: this.toMin(b.hora_inicio),
        end: this.toMin(b.hora_fin),
      }));
      const barberoChoca = activeBlocksCollide(startMin, itemsParaChequeo, activeBlocksMinutos);

      collision = sinSillaLibre || barberoChoca;
    }

    if (collision) {
      throw new ConflictError("El horario seleccionado ya está ocupado");
    }

    // booking.service_id es opcional/deprecado desde que las reservas
    // multi-servicio guardan sus servicios en booking_items en vez de en
    // esta columna (ver Booking.ts). Mientras el modelo viejo siga
    // existiendo en paralelo (Fase 3-5 del plan de migración), modify()
    // todavía requiere service_id como string — si la reserva no lo tiene
    // (fue creada vía createWithItems), se usa el primer servicio de sus
    // booking_items actuales como equivalente. Esto solo afecta a esta
    // columna legacy: no toca los booking_items reales de la reserva.
    const fallbackServiceId = nuevosServicios[0]?.id
      ?? booking.service_id
      ?? (await this.bookingRepository.findItemsByBookingId(booking.id))[0]?.service_id;

    if (!fallbackServiceId) {
      throw new AppError(
        "No se pudo determinar el servicio de la reserva para modificarla",
        500,
      );
    }

    // IMPORTANTE: modify() va PRIMERO. bookings_no_overlap_por_silla se
    // evalúa acá mismo, como red de seguridad final para el rango real que
    // va a ocupar la reserva (fecha/hora/barbero nuevos) — aunque ya
    // verificamos colisión arriba en código, esto protege contra una
    // condición de carrera de último milisegundo.
    const updated = await this.bookingRepository.modify(input.bookingId, {
      fecha:       input.fecha,
      hora_inicio: input.horaInicio,
      hora_fin:    horaFinEfectiva,
      barber_id:   targetBarberId,
      service_id:  input.serviceId ?? fallbackServiceId,
      estado:      booking.estado === "confirmada" ? "confirmada" : "pendiente",
      modified_at: new Date().toISOString(),
    });

    // Los booking_active_blocks tienen que quedar anclados al horario NUEVO
    // (recién confirmado arriba), no al viejo. Dos casos:
    if (nuevosServicios.length > 0) {
      // Se reemplaza el combo: replaceItems hace DELETE+INSERT de
      // booking_items y regenera los bloques activos en el mismo paso —
      // como modify() ya corrió, lee fecha/hora_inicio/barber_id ya
      // actualizados de la fila de bookings.
      await this.bookingRepository.replaceItems(
        input.bookingId,
        horaFinEfectiva,
        nuevosServicios.map((s, index) => ({
          service_id: s.id,
          nombre: s.nombre,
          precio: s.precio,
          duracion_minutos: s.duracion_minutos,
          orden: index,
          tiempo_activo_inicial_minutos: s.tiempo_activo_inicial_minutos,
          tiempo_procesamiento_minutos: s.tiempo_procesamiento_minutos,
        })),
      );
    } else if (
      input.fecha !== booking.fecha ||
      input.horaInicio !== booking.hora_inicio ||
      targetBarberId !== booking.barber_id
    ) {
      // Se reprograma (fecha/hora/barbero) sin tocar el combo de servicios.
      // Sin esto, los bloques activos quedarían apuntando al horario y
      // barbero VIEJOS — el mismo tipo de "bloque fantasma" que dejaba
      // huérfano no cancelar bien un turno (ver BookingRepository.cancel).
      await this.bookingRepository.regenerateActiveBlocks(input.bookingId);
    }

    invalidateSlotsCache(input.businessId);

    logger.info("Reserva modificada", {
      bookingId:     input.bookingId,
      businessId:    input.businessId,
      fechaAnterior: booking.fecha,
      fechaNueva:    input.fecha,
      horaAnterior:  booking.hora_inicio,
      horaNueva:     input.horaInicio,
      barberId:      targetBarberId,
      serviciosReemplazados: nuevosServicios.length > 0,
    });

    return updated;
  }

  private sumarMinutos(hora: string, minutos: number): string {
    const [h, m] = hora.split(":").map(Number);
    const total = h * 60 + m + minutos;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
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
