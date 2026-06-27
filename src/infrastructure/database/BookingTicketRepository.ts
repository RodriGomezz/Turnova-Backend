import { supabase } from "./supabase.client";
import { AppError } from "../../domain/errors";
import { BookingTicket } from "../../domain/entities/Booking";
import { IBookingTicketRepository } from "../../domain/interfaces/IBookingTicketRepository";

export class BookingTicketRepository implements IBookingTicketRepository {
  private readonly table = "booking_tickets";

  async findByBookingId(bookingId: string): Promise<BookingTicket | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("booking_id", bookingId)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as BookingTicket;
  }

  /** Marca la cuenta como cobrada. A partir de acá los booking_items son inmutables. */
  async cerrar(bookingId: string, metodoPago: string | null): Promise<BookingTicket> {
    const { data, error } = await supabase
      .from(this.table)
      .update({
        estado: "cobrado",
        cobrado_at: new Date().toISOString(),
        metodo_pago: metodoPago,
      })
      .eq("booking_id", bookingId)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return data as BookingTicket;
  }
}
