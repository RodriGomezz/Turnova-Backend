import { z } from 'zod';

export const createBarberSchema = z.object({
  nombre: z.string().min(2).max(100).trim(),
  descripcion: z.string().max(500).trim().optional(),
  orden: z.number().int().min(0).optional(),
});

export const updateBarberSchema = createBarberSchema.partial().extend({
  foto_url: z.string().url().nullable().optional(),
});

export type CreateBarberInput = z.infer<typeof createBarberSchema>;
export type UpdateBarberInput = z.infer<typeof updateBarberSchema>;

