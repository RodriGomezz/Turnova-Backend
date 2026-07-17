export type BookingEstado =
  | "pendiente"
  | "confirmada"
  | "cancelada"
  | "modificada"
  | "no_show";

export interface Booking {
  id: string;
  business_id: string;
  barber_id: string;
  /**
   * @deprecated Se mantiene hasta completar la migración a booking_items
   * (ver Fase 6 del plan de migración). No usar en código nuevo — leer
   * los servicios de una reserva desde BookingItem[] vía booking_id.
   * La columna sigue existiendo en BD durante la transición pero ya no
   * es la fuente de verdad: CreateBookingUseCase no la escribe más.
   */
  service_id?: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: BookingEstado;
  cancellation_token: string;
  reminder_sent_at: string | null;
  /** Timestamp de la última modificación de fecha/hora/profesional */
  modified_at?: string | null;
  /** Timestamp de cancelación (reemplaza borrado lógico) */
  cancelled_at?: string | null;
  /** Motivo de cancelación ingresado por el negocio */
  cancel_reason?: string | null;
  /**
   * Timestamp de cuando se marcó la reserva como "no asistió". Se excluye
   * de ingresosMes/ingresoDia (igual que cancelada) pero se cuenta aparte
   * en un contador noShows, para que el negocio pueda ver su tasa de
   * inasistencia sin que infle ni vacíe los reportes de facturación.
   */
  no_show_at?: string | null;
  created_at: string;
}

/**
 * Línea de detalle de una reserva. Una reserva tiene 1..N booking_items.
 * nombre y precio son snapshots tomados al crear el ítem — nunca se leen
 * en vivo desde Service, para que los reportes históricos no muten si
 * el negocio cambia precios después.
 */
export interface BookingItem {
  id: string;
  booking_id: string;
  service_id: string;
  nombre: string;
  precio: number;
  duracion_minutos: number;
  /**
   * Posición secuencial dentro de la reserva (0 = primero). Los items se
   * ejecutan uno después del otro, en este orden — necesario para calcular
   * en qué instante absoluto empieza cada uno dentro del turno.
   */
  orden: number;
  /** Snapshot de services.tiempo_activo_inicial_minutos al crear el item. */
  tiempo_activo_inicial_minutos: number;
  /** Snapshot de services.tiempo_procesamiento_minutos al crear el item. */
  tiempo_procesamiento_minutos: number;
  created_at: string;
}

export type BookingTicketEstado = "abierto" | "cobrado";

/**
 * Estado de cobro de una reserva, separado de su estado de agenda.
 * 'abierto': los booking_items son mutables (agregar, quitar, editar precio).
 * 'cobrado': inmutable — para corregir, se anula y se recrea la venta.
 * No depende de cuánto tiempo pasó desde hora_fin: el negocio decide
 * cuándo cierra la cuenta, no un timer del sistema.
 */
export interface BookingTicket {
  booking_id: string;
  estado: BookingTicketEstado;
  cobrado_at: string | null;
  metodo_pago: string | null;
}
