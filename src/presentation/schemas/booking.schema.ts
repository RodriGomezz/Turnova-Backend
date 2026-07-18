import { z } from 'zod';

export const createBookingSchema = z.object({
  barber_id: z.string().uuid(),
  /** @deprecated Usar service_ids. Se mantiene mientras el frontend viejo siga enviándolo. */
  service_id: z.string().uuid().optional(),
  /** Uno o más servicios de la reserva. */
  service_ids: z.array(z.string().uuid()).min(1).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  cliente_nombre: z.string().min(2).max(100).trim(),
  cliente_email: z.string().email().toLowerCase().trim(),
  cliente_telefono: z.string()
  .transform(v => v.replace(/[\s-]/g, '')) // limpia espacios y guiones
  .pipe(z.string().regex(/^09\d{7}$/, 'Teléfono uruguayo inválido (09XXXXXXX)')),
  /**
   * Generada por el frontend UNA sola vez al entrar al paso de confirmación
   * (no en cada click) y reenviada igual en reintentos — permite que
   * create_booking_with_items detecte "este pedido ya lo procesé" y
   * devuelva la reserva existente en vez de crear una duplicada. Opcional
   * por compatibilidad con clientes viejos que todavía no la mandan.
   */
  idempotency_key: z.string().uuid().optional(),
}).refine(
  (data) => !!data.service_id || !!data.service_ids?.length,
  { message: 'Se requiere service_id o service_ids', path: ['service_ids'] },
);

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const addBookingItemSchema = z.object({
  service_id: z.string().uuid().optional(),
  nombre_personalizado: z.string().min(1).max(100).trim().optional(),
  precio: z.number().min(0),
  duracion_minutos: z.number().int().min(0).optional(),
});

export type AddBookingItemInput = z.infer<typeof addBookingItemSchema>;

export const cerrarTicketSchema = z.object({
  metodo_pago: z.string().max(50).optional(),
});

export type CerrarTicketInput = z.infer<typeof cerrarTicketSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().max(200).trim().optional(),
});

export type CancelBookingRequestInput = z.infer<typeof cancelBookingSchema>;
