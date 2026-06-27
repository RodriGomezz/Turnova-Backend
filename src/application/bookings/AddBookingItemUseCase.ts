import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IBookingItemRepository } from "../../domain/interfaces/IBookingItemRepository";
import { IBookingTicketRepository } from "../../domain/interfaces/IBookingTicketRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { Booking, BookingItem } from "../../domain/entities/Booking";
import { NotFoundError, ConflictError } from "../../domain/errors";

export interface AddBookingItemInput {
  booking_id: string;
  /** Si se omite, se usa el servicio genérico ("Otros / Varios") del negocio. */
  service_id?: string;
  /** Nombre a mostrar para este ítem. Si se omite, se usa el nombre del service. */
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

    const ticket = await this.bookingTicketRepository.findByBookingId(booking.id);
    if (ticket?.estado === "cobrado") {
      throw new ConflictError(
        "Esta cuenta ya fue cobrada y cerrada. Para corregirla, anulá la venta y registrala de nuevo.",
      );
    }

    const service = input.service_id
      ? (await this.serviceRepository.findByIds([input.service_id]))[0]
      : await this.serviceRepository.findGenerico(booking.business_id);

    if (!service) throw new NotFoundError("Servicio");
    if (service.business_id !== booking.business_id) {
      throw new NotFoundError("Servicio");
    }

    const duracion = input.duracion_minutos ?? 0;

    // Sin duración (producto / adicional sin tiempo): se registra y listo,
    // nunca se toca la agenda.
    if (duracion === 0) {
      const item = await this.bookingItemRepository.create({
        booking_id: booking.id,
        service_id: service.id,
        nombre: input.nombre_personalizado ?? service.nombre,
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
        service_id: service.id,
        nombre: input.nombre_personalizado ?? service.nombre,
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
        service_id: booking.service_id ?? service.id,
        estado: booking.estado === "pendiente" ? "pendiente" : "confirmada",
        modified_at: new Date().toISOString(),
      });
      const item = await this.bookingItemRepository.create({
        booking_id: booking.id,
        service_id: service.id,
        nombre: input.nombre_personalizado ?? service.nombre,
        precio: input.precio,
        duracion_minutos: duracion,
      });
      return { booking: updated, item, agendaExtendida: true };
    } catch (error) {
      // ConflictError = colisión real con el siguiente turno (bookings_no_overlap).
      // La venta se registra igual; el barbero coordina manualmente con el
      // cliente siguiente — ver AddBookingItemResult.agendaExtendida.
      if (error instanceof ConflictError) {
        const item = await this.bookingItemRepository.create({
          booking_id: booking.id,
          service_id: service.id,
          nombre: input.nombre_personalizado ?? service.nombre,
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
}
