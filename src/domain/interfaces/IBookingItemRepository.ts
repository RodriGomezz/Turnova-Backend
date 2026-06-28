import { BookingItem } from "../entities/Booking";

export interface CreateBookingItemData {
  booking_id: string;
  service_id: string;
  nombre: string;
  precio: number;
  duracion_minutos: number;
}

export interface IBookingItemRepository {
  findByBookingId(bookingId: string): Promise<BookingItem[]>;
  findById(id: string): Promise<BookingItem | null>;
  create(data: CreateBookingItemData): Promise<BookingItem>;
  delete(id: string): Promise<void>;
}
