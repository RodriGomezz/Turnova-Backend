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
  /** Posición secuencial dentro de la reserva (0 = primero). */
  orden: number;
  /** Snapshot de services.tiempo_activo_inicial_minutos. Si se omite, todo el item es activo. */
  tiempo_activo_inicial_minutos?: number;
  /** Snapshot de services.tiempo_procesamiento_minutos. Si se omite, 0 (sin procesamiento). */
  tiempo_procesamiento_minutos?: number;
}

/** Bloque de atención activa ya ocupado por otra reserva del mismo barbero ese día. */
export interface ActiveBlockRow {
  hora_inicio: string; // "HH:MM", ya recortado a minutos
  hora_fin: string;
}

/** Igual que ActiveBlockRow pero con la fecha — para consultas de rango de mes,
 * donde hace falta agrupar los bloques por día antes de evaluarlos. */
export interface ActiveBlockRowWithFecha extends ActiveBlockRow {
  fecha: string; // "YYYY-MM-DD"
}

export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByCancellationToken(token: string): Promise<Booking | null>;
  findByBusinessAndDate(businessId: string, fecha: string): Promise<Booking[]>;
  /** Ver comentario en BookingRepository.findByIdempotencyKey. */
  findByIdempotencyKey(key: string): Promise<Booking | null>;
  findByBarberAndDate(barberId: string, fecha: string): Promise<Booking[]>;
  /**
   * Bloques de atención activa (no de silla) de todas las reservas no
   * canceladas de este barbero ese día — la fuente de verdad para el
   * chequeo de disponibilidad cuando el barbero tiene capacidad_sillas > 1.
   * Ver domain/booking-scheduling.ts (activeBlocksCollide) para cómo se usan.
   */
  findActiveBlocksByBarberAndDate(
    barberId: string,
    fecha: string,
    excludeBookingId?: string,
  ): Promise<ActiveBlockRow[]>;
  /**
   * Igual que findActiveBlocksByBarberAndDate pero para un rango [from, to]
   * de fechas de una sola vez — usada por GetAllSlotsForDaysUseCase para no
   * hacer una query por día del mes. Ver comentario en isSlotDisponible
   * (domain/booking-scheduling.ts) sobre por qué ambos use cases comparten
   * la misma fuente de datos y lógica.
   */
  findActiveBlocksByBarberAndMonth(
    barberId: string,
    from: string,
    to: string,
    excludeBookingId?: string,
  ): Promise<ActiveBlockRowWithFecha[]>;
  /**
   * Inserta bloques de atención activa para una reserva ya existente — usado
   * por AddBookingItemUseCase cuando se agrega un servicio in-situ a un
   * turno en curso (a diferencia de createWithItems/replaceItems, que ya
   * los generan solos dentro de su propia transacción). Si algún bloque
   * choca con booking_active_blocks_no_overlap, lanza ConflictError igual
   * que el resto de las operaciones de escritura sobre bookings.
   */
  createActiveBlocks(
    bookingId: string,
    barberId: string,
    blocks: Array<{ starts_at: string; ends_at: string }>,
  ): Promise<void>;
  /**
   * Regenera los booking_active_blocks de una reserva ya existente, leyendo
   * sus booking_items actuales (orden + fases ya guardadas). Se usa cuando
   * se reprograma una reserva (fecha/hora/barbero) sin reemplazar el combo
   * de servicios — ver nota en ModifyBookingUseCase y migración 018.
   */
  regenerateActiveBlocks(bookingId: string): Promise<void>;
  findByBarberAndMonth(
    barberId: string,
    businessId: string,
    from: string,
    to: string,
  ): Promise<Pick<Booking, "id" | "fecha" | "hora_inicio" | "hora_fin">[]>;
  findConfirmedUpcomingWithoutReminder(maxDays: number): Promise<Booking[]>;
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
    bookingData: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at" | "service_id" | "idempotency_key">,
    items: CreateBookingItemInput[],
    idempotencyKey?: string,
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
