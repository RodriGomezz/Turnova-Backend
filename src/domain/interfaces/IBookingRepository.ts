import { Booking, BookingEstado } from "../entities/Booking";

export interface BookingsByMonth {
  fecha: string;
  total: number;
}

export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByCancellationToken(token: string): Promise<Booking | null>;
  findByBusinessAndDate(businessId: string, fecha: string): Promise<Booking[]>;
  findByBarberAndDate(barberId: string, fecha: string): Promise<Booking[]>;
  findByBarberAndMonth(
    barberId: string,
    businessId: string,
    from: string,
    to: string,
  ): Promise<Pick<Booking, "fecha" | "hora_inicio" | "hora_fin">[]>;
  findPendingReminders(): Promise<Booking[]>;
  findEmailsByBusiness(
    businessId: string,
    beforeFecha: string,
    emails: string[],
  ): Promise<string[]>;
  create(data: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at">): Promise<Booking>;
  updateEstado(id: string, estado: BookingEstado): Promise<Booking>;
  modify(
    id: string,
    data: {
      fecha: string;
      hora_inicio: string;
      hora_fin: string;
      barber_id: string;
      service_id: string;
      estado: "modificada";
      modified_at: string;
    },
  ): Promise<Booking>;
  cancel(
    id: string,
    data: { cancelled_at: string; cancel_reason: string | null },
  ): Promise<Booking>;
  markReminderSent(id: string): Promise<void>;
  countByMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<BookingsByMonth[]>;
  countByBusinessAndMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<number>;
}
