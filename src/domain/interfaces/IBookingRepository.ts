import { Booking, BookingEstado, BookingItem } from "../entities/Booking";

export interface BookingsByMonth {
  fecha: string;
  total: number;
}

/** Ítem de entrada para crear una reserva con múltiples servicios. */
export interface CreateBookingItemInput {
  service_id: string;
  nombre: string;
  precio: number;
  duracion_minutos: number;
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
  ): Promise<Pick<Booking, "id" | "fecha" | "hora_inicio" | "hora_fin">[]>;
  findPendingReminders(): Promise<Booking[]>;
  findEmailsByBusiness(
    businessId: string,
    beforeFecha: string,
    emails: string[],
  ): Promise<string[]>;
  /**
   * @deprecated Usar createWithItems — se mantiene solo mientras el frontend
   * viejo siga mandando service_id singular (ver Fase 3 del plan de migración).
   */
  create(data: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at">): Promise<Booking>;
  /**
   * Crea una reserva con uno o más booking_items y su booking_ticket inicial
   * ('abierto'), todo en una sola transacción de Postgres (función RPC
   * create_booking_with_items). El constraint bookings_no_overlap se evalúa
   * dentro de la misma transacción: si hay colisión, no quedan items huérfanos.
   */
  createWithItems(
    bookingData: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at" | "service_id">,
    items: CreateBookingItemInput[],
  ): Promise<Booking>;
  /** Ítems de detalle de una reserva (servicios + productos cobrados). */
  findItemsByBookingId(bookingId: string): Promise<BookingItem[]>;
  /**
   * Reemplaza el combo completo de servicios de una reserva existente y
   * actualiza hora_fin acorde a la nueva duración total, en una sola
   * transacción (función RPC replace_booking_items). Para uso de
   * ModifyBookingUseCase cuando se cambia el conjunto de servicios antes
   * de que el turno empiece — no confundir con AddBookingItemUseCase,
   * que agrega ítems sueltos a una reserva ya en curso o pasada.
   */
  replaceItems(
    bookingId: string,
    horaFin: string,
    items: CreateBookingItemInput[],
  ): Promise<Booking>;
  updateEstado(id: string, estado: BookingEstado): Promise<Booking>;
  modify(
    id: string,
    data: {
      fecha: string;
      hora_inicio: string;
      hora_fin: string;
      barber_id: string;
      service_id: string;
      estado: "modificada" | "confirmada" | "pendiente";
      modified_at: string;
    },
  ): Promise<Booking>;
  cancel(
    id: string,
    data: { cancelled_at: string; cancel_reason: string | null },
  ): Promise<Booking>;
  markReminderSent(id: string): Promise<void>;
  /**
   * Busca reservas anteriores a `beforeFecha` que coincidan con alguno de
   * los emails O teléfonos dados. Usado para detectar clientes nuevos vs recurrentes.
   */
  findPreviousClientMatchesByBusiness(
    businessId: string,
    beforeFecha: string,
    emails: string[],
    phones: string[],
  ): Promise<Pick<Booking, "cliente_email" | "cliente_telefono">[]>;

  findByBusinessAndMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<Booking[]>;
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
  countFutureByBarber(barberId: string, businessId: string): Promise<number>;
}
