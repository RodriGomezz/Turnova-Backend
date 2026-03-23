import { z } from 'zod';

export const createScheduleSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:MM)'),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:MM)'),
  barber_id: z.string().uuid().optional(),
}).refine(
  (data) => data.hora_inicio < data.hora_fin,
  { message: 'hora_fin debe ser mayor que hora_inicio', path: ['hora_fin'] }
);

export const updateScheduleSchema = z.object({
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  activo: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.hora_inicio && data.hora_fin) {
      return data.hora_inicio < data.hora_fin;
    }
    return true;
  },
  { message: 'hora_fin debe ser mayor que hora_inicio', path: ['hora_fin'] }
);

export const createBlockedDateSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)"),
  fecha_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)")
    .optional(),
  motivo: z.string().max(255).trim().optional(),
  barber_id: z.string().uuid().optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;