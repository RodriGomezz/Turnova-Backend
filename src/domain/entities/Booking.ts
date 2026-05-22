export type BookingEstado =
  | "pendiente"
  | "confirmada"
  | "cancelada";

export interface Booking {
  id: string;
  business_id: string;
  barber_id: string;
  service_id: string;
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
  created_at: string;
}
