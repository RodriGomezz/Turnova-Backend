import { z } from 'zod';

export const createBookingSchema = z.object({
  barber_id: z.string().uuid(),
  service_id: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  cliente_nombre: z.string().min(2).max(100).trim(),
  cliente_email: z.string().email().toLowerCase().trim(),
  cliente_telefono: z.string().regex(/^09\d{7}$/, 'Teléfono uruguayo inválido (09XXXXXXX)'),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;