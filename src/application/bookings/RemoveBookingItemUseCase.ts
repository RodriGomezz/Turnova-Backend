import { IBookingItemRepository } from "../../domain/interfaces/IBookingItemRepository";
import { IBookingTicketRepository } from "../../domain/interfaces/IBookingTicketRepository";
import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { NotFoundError, ConflictError } from "../../domain/errors";

export interface RemoveBookingItemInput {
  booking_id: string;
  item_id: string;
}

/**
 * Quita un ítem (servicio/producto) ya agregado a una reserva — caso típico:
 * el barbero agregó algo de más por error, o necesita corregir una cuenta de
 * un día anterior porque no pudo entrar al sistema en el momento (ver
 * conversación de soporte: "se olvida de hacerlo lo puede hacer después").
 *
 * Misma protección que AddBookingItemUseCase: bloqueado si el ticket ya está
 * cobrado y cerrado. Sin límite de fecha — mientras la cuenta siga abierta,
 * no importa si la reserva fue hace 3 días o hace una hora.
 *
 * A diferencia de AddBookingItemUseCase, esto NO toca hora_fin de la reserva.
 * Si el ítem que se quita tenía duración y en su momento extendió la agenda,
 * revertir ese cálculo de forma segura requeriría confirmar que nada más se
 * agendó en el rango extendido desde entonces — fuera de alcance acá; si la
 * reserva es futura, el barbero puede ajustar el horario manualmente desde
 * "Editar".
 */
export class RemoveBookingItemUseCase {
  constructor(
    private readonly bookingItemRepository: IBookingItemRepository,
    private readonly bookingTicketRepository: IBookingTicketRepository,
    private readonly bookingRepository: IBookingRepository,
  ) {}

  async execute(input: RemoveBookingItemInput): Promise<void> {
    const booking = await this.bookingRepository.findById(input.booking_id);
    if (!booking) throw new NotFoundError("Reserva");

    const item = await this.bookingItemRepository.findById(input.item_id);
    if (!item || item.booking_id !== input.booking_id) {
      throw new NotFoundError("Ítem de la reserva");
    }

    const ticket = await this.bookingTicketRepository.findByBookingId(booking.id);
    if (ticket?.estado === "cobrado") {
      throw new ConflictError(
        "Esta cuenta ya fue cobrada y cerrada. Para corregirla, anulá la venta y registrala de nuevo.",
      );
    }

    // No se exige un mínimo de ítems restantes — una reserva puede quedar
    // momentáneamente sin ítems si el barbero está corrigiendo la cuenta
    // (por ejemplo, va a agregar el ítem correcto a continuación).
    await this.bookingItemRepository.delete(input.item_id);
  }
}
