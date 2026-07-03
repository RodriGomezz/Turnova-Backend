import { z } from 'zod';

const timeRegex = /^\d{2}:\d{2}$/;

export const createScheduleSchema = z.object({
  dia_semana:  z.number().int().min(0).max(6),
  hora_inicio: z.string().regex(timeRegex, 'Formato inválido (HH:MM)'),
  hora_fin:    z.string().regex(timeRegex, 'Formato inválido (HH:MM)'),
  barber_id:   z.string().uuid().optional(),
  break_start: z.string().regex(timeRegex, 'Formato inválido (HH:MM)').nullable().optional(),
  break_end:   z.string().regex(timeRegex, 'Formato inválido (HH:MM)').nullable().optional(),
})
  .refine(
    (d) => d.hora_inicio < d.hora_fin,
    { message: 'hora_fin debe ser mayor que hora_inicio', path: ['hora_fin'] },
  )
  .refine(
    (d) => {
      const hasBreak = d.break_start && d.break_end;
      if (!hasBreak) return true;
      return d.break_start! < d.break_end!;
    },
    { message: 'break_end debe ser mayor que break_start', path: ['break_end'] },
  )
  .refine(
    (d) => {
      const hasBreak = d.break_start && d.break_end;
      if (!hasBreak) return true;
      return d.break_start! >= d.hora_inicio && d.break_end! <= d.hora_fin;
    },
    { message: 'El descanso debe estar dentro del horario de atención', path: ['break_start'] },
  );

export const updateScheduleSchema = z.object({
  hora_inicio: z.string().regex(timeRegex).optional(),
  hora_fin:    z.string().regex(timeRegex).optional(),
  break_start: z.string().regex(timeRegex).nullable().optional(),
  break_end:   z.string().regex(timeRegex).nullable().optional(),
  activo:      z.boolean().optional(),
})
  .refine(
    (d) => {
      if (d.hora_inicio && d.hora_fin) return d.hora_inicio < d.hora_fin;
      return true;
    },
    { message: 'hora_fin debe ser mayor que hora_inicio', path: ['hora_fin'] },
  )
  .refine(
    (d) => {
      const hasBreak = d.break_start && d.break_end;
      if (!hasBreak) return true;
      return d.break_start! < d.break_end!;
    },
    { message: 'break_end debe ser mayor que break_start', path: ['break_end'] },
  );

export const createBlockedDateSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)"),
  fecha_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)")
    .optional(),
  motivo:    z.string().max(255).trim().optional(),
  barber_id: z.string().uuid().optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;