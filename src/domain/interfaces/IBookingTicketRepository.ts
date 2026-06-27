import { BookingTicket } from "../entities/Booking";

export interface IBookingTicketRepository {
  findByBookingId(bookingId: string): Promise<BookingTicket | null>;
  /** Marca la cuenta como cobrada — a partir de acá, sus booking_items son inmutables. */
  cerrar(bookingId: string, metodoPago: string | null): Promise<BookingTicket>;
}
