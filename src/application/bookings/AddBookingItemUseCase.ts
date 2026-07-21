import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IBookingItemRepository } from "../../domain/interfaces/IBookingItemRepository";
import { IBookingTicketRepository } from "../../domain/interfaces/IBookingTicketRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { Service } from "../../domain/entities/Service";
import { Booking, BookingItem } from "../../domain/entities/Booking";
import { NotFoundError, ConflictError, ValidationError } from "../../domain/errors";
import { computeActiveBlocks } from "../../domain/booking-scheduling";

export interface AddBookingItemInput {
  booking_id: string;
  /** Si se omite, el ítem se registra sin servicio de catálogo (service_id null) — requiere nombre_personalizado. */
  service_id?: string;
  /** Nombre a mostrar para este ítem. Obligatorio si se omite service_id; si no, se usa el nombre del service. */
  nombre_personalizado?: string;
  /** Precio a cobrar. Siempre requerido — nunca se asume el precio de catálogo,
   *  porque quien agrega el ítem (el barbero) es quien decide cuánto cobrar
   *  en el momento, igual que permite AgendaPro al editar el precio en el carro. */
  precio: number;
  /** 0 para productos o adicionales sin tiempo (ej. una crema). */
  duracion_minutos?: number;
}

export interface AddBookingItemResult {
  booking: Booking;
  item: BookingItem;
  /**
   * true si se logró extender hora_fin para reflejar el tiempo adicional.
   * false si: el ítem no consume tiempo (duracion_minutos = 0), el turno
   * siguiente del mismo barbero ya empezó (ya no hay nada que proteger),
   * o hubo colisión real con bookings_no_overlap. En todos los casos el
   * ítem se registra igual — la venta nunca se pierde por un problema de agenda.
   */
  agendaExtendida: boolean;
}

export class AddBookingItemUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly bookingItemRepository: IBookingItemRepository,
    private readonly bookingTicketRepository: IBookingTicketRepository,
    private readonly serviceRepository: IServiceRepository,
  ) {}

  async execute(input: AddBookingItemInput): Promise<AddBookingItemResult> {
    const booking = await this.bookingRepository.findById(input.booking_id);
    if (!booking) throw new NotFoundError("Reserva");

    if (booking.estado === "no_show") {
      throw new ConflictError(
        "No se puede agregar un servicio a una reserva marcada como no asistió. Si el cliente llegó, revertí el estado a confirmada primero.",
      );
    }
    if (booking.estado === "cancelada") {
      throw new ConflictError("No se puede agregar un servicio a una reserva cancelada.");
    }

    const ticket = await this.bookingTicketRepository.findByBookingId(booking.id);
    if (ticket?.estado === "cobrado") {
      throw new ConflictError(
        "Esta cuenta ya fue cobrada y cerrada. Para corregirla, anulá la venta y registrala de nuevo.",
      );
    }

    let service: Service | null = null;
    if (input.service_id) {
      service = (await this.serviceRepository.findByIds([input.service_id]))[0] ?? null;
      if (!service) throw new NotFoundError("Servicio");
      if (service.business_id !== booking.business_id) {
        throw new NotFoundError("Servicio");
      }
    } else if (!input.nombre_personalizado?.trim()) {
      // Sin service_id el ítem no tiene de dónde sacar un nombre — a
      // diferencia de antes, ya no hay un servicio genérico de fallback.
      throw new ValidationError(
        "Elegí un servicio del catálogo o ingresá un nombre para el ítem.",
      );
    }

    const nombreItem = input.nombre_personalizado?.trim() || service!.nombre;

    const duracion = input.duracion_minutos ?? 0;

    // Sin duración (producto / adicional sin tiempo): se registra y listo,
    // nunca se toca la agenda.
    if (duracion === 0) {
      const item = await this.bookingItemRepository.create({
        booking_id: booking.id,
        service_id: service?.id ?? null,
        nombre: nombreItem,
        precio: input.precio,
        duracion_minutos: 0,
      });
      return { booking, item, agendaExtendida: false };
    }

    // Con duración: solo tiene sentido intentar extender la agenda si todavía
    // hay un turno futuro del mismo barbero que proteger. Si ya pasó o el
    // siguiente turno ya empezó, no hay nada que extender — se registra
    // la venta igual, sin tratarlo como error.
    const siguienteTurnoYaEmpezo = await this.existeTurnoEnCurso(booking);
    if (siguienteTurnoYaEmpezo) {
      const item = await this.bookingItemRepository.create({
        booking_id: booking.id,
        service_id: service?.id ?? null,
        nombre: nombreItem,
        precio: input.precio,
        duracion_minutos: duracion,
      });
      return { booking, item, agendaExtendida: false };
    }

    const nuevaHoraFin = this.sumarMinutos(booking.hora_fin, duracion);

    try {
      const updated = await this.bookingRepository.modify(booking.id, {
        fecha: booking.fecha,
        hora_inicio: booking.hora_inicio,
        hora_fin: nuevaHoraFin,
        barber_id: booking.barber_id,
        // bookings.service_id es la columna legacy 1:1 previa al modelo
        // multi-servicio (ver comentario en Booking entity) — booking_items
        // es la fuente de verdad real. Se mantiene por compatibilidad con
        // consumidores viejos que aún la lean; si el ítem es libre (sin
        // catálogo) no hay nada mejor que ofrecerle, así que no se toca.
        service_id: (booking.service_id ?? service?.id) as string,
        estado: booking.estado === "pendiente" ? "pendiente" : "confirmada",
        modified_at: new Date().toISOString(),
      });

      const existentes = await this.bookingRepository.findItemsByBookingId(booking.id);
      const orden = existentes.length;

      const item = await this.bookingItemRepository.create({
        booking_id: booking.id,
        service_id: service?.id ?? null,
        nombre: nombreItem,
        precio: input.precio,
        duracion_minutos: duracion,
        orden,
        tiempo_activo_inicial_minutos: service?.tiempo_activo_inicial_minutos ?? duracion,
        tiempo_procesamiento_minutos: service?.tiempo_procesamiento_minutos ?? 0,
      });

      // El item nuevo empieza exactamente donde terminaba la reserva antes
      // de extenderla (booking.hora_fin, el valor viejo) — los items son
      // secuenciales, así que ese es su offset absoluto real.
      const blocks = computeActiveBlocks([
        {
          orden: 0,
          duracion_minutos: duracion,
          tiempo_activo_inicial_minutos: service?.tiempo_activo_inicial_minutos ?? duracion,
          tiempo_procesamiento_minutos: service?.tiempo_procesamiento_minutos ?? 0,
        },
      ]);
      if (blocks.length > 0) {
        const baseInicio = this.combinarFechaHora(booking.fecha, booking.hora_fin);
        await this.bookingRepository.createActiveBlocks(
          booking.id,
          booking.barber_id,
          blocks.map((b) => ({
            starts_at: this.sumarMinutosISO(baseInicio, b.startsAtMinuteOffset),
            ends_at: this.sumarMinutosISO(baseInicio, b.endsAtMinuteOffset),
          })),
        );
      }

      return { booking: updated, item, agendaExtendida: true };
    } catch (error) {
      // ConflictError = colisión real, ya sea con el siguiente turno
      // (bookings_no_overlap_por_silla) o con la atención activa de otro
      // turno (booking_active_blocks_no_overlap) si el barbero tiene más
      // de una silla. La venta se registra igual; el barbero coordina
      // manualmente con el cliente siguiente — ver AddBookingItemResult.agendaExtendida.
      if (error instanceof ConflictError) {
        const item = await this.bookingItemRepository.create({
          booking_id: booking.id,
          service_id: service?.id ?? null,
          nombre: nombreItem,
          precio: input.precio,
          duracion_minutos: duracion,
        });
        return { booking, item, agendaExtendida: false };
      }
      throw error;
    }
  }

  /**
   * true si el barbero ya tiene otro turno (no cancelado) que empieza
   * antes o en el mismo instante en que terminaría el turno actual si
   * se intentara extender. En ese caso no hay agenda futura que proteger
   * extendiendo hora_fin retroactivamente.
   */
  private async existeTurnoEnCurso(booking: Booking): Promise<boolean> {
    const turnosDelDia = await this.bookingRepository.findByBarberAndDate(
      booking.barber_id,
      booking.fecha,
    );
    const ahora = new Date();
    const horaActual = `${ahora.getHours().toString().padStart(2, "0")}:${ahora
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    return turnosDelDia.some(
      (b) => b.id !== booking.id && b.hora_inicio <= horaActual && b.hora_fin > horaActual,
    );
  }

  private sumarMinutos(hora: string, minutos: number): string {
    const [h, m] = hora.split(":").map(Number);
    const total = h * 60 + m + minutos;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  }

  /** "2026-04-21" + "10:45" → "2026-04-21T10:45:00" (naive, sin timezone —
   *  igual criterio que el resto del cálculo de horarios de este backend). */
  private combinarFechaHora(fecha: string, hora: string): string {
    return `${fecha}T${hora.slice(0, 5)}:00`;
  }

  /** Suma minutos a un timestamp naive "YYYY-MM-DDTHH:MM:SS" sin usar Date
   *  (evitaría bugs de timezone si Date interpretara el string como UTC). */
  private sumarMinutosISO(isoNaive: string, minutos: number): string {
    const [fecha, horaConSegundos] = isoNaive.split("T");
    const [h, m] = horaConSegundos.split(":").map(Number);
    const totalMin = h * 60 + m + minutos;
    const diasExtra = Math.floor(totalMin / (24 * 60));
    const minutoDelDia = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = Math.floor(minutoDelDia / 60).toString().padStart(2, "0");
    const mm = (minutoDelDia % 60).toString().padStart(2, "0");

    if (diasExtra === 0) {
      return `${fecha}T${hh}:${mm}:00`;
    }
    // Un item que cruza medianoche sería un bug de configuración de horario
    // de por sí (nadie agenda un corte de 23:50 a 00:20) — lo resolvemos
    // corriendo la fecha para no generar un rango inválido (fin < inicio),
    // pero es un caso que no debería pasar en la práctica.
    const [y, mo, d] = fecha.split("-").map(Number);
    const fechaBase = new Date(y, mo - 1, d);
    fechaBase.setDate(fechaBase.getDate() + diasExtra);
    const fechaStr = `${fechaBase.getFullYear()}-${(fechaBase.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${fechaBase.getDate().toString().padStart(2, "0")}`;
    return `${fechaStr}T${hh}:${mm}:00`;
  }
}
