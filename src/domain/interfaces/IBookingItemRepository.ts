import { BookingItem } from "../entities/Booking";

export interface CreateBookingItemData {
  booking_id: string;
  service_id: string;
  nombre: string;
  precio: number;
  duracion_minutos: number;
  /** Posición secuencial dentro de la reserva. Si se omite, default 0 en BD. */
  orden?: number;
  tiempo_activo_inicial_minutos?: number;
  tiempo_procesamiento_minutos?: number;
}

export interface IBookingItemRepository {
  findByBookingId(bookingId: string): Promise<BookingItem[]>;
  findById(id: string): Promise<BookingItem | null>;
  create(data: CreateBookingItemData): Promise<BookingItem>;
  delete(id: string): Promise<void>;
}
