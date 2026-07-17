import { z } from 'zod';

export const createBarberSchema = z.object({
  nombre:      z.string().min(2).max(100).trim(),
  descripcion: z.string().max(500).trim().optional(),
  orden:       z.number().int().min(0).optional(),
  /**
   * Cantidad de sillas/estaciones que este barbero puede usar en simultáneo.
   * Omitido o 1 = comportamiento actual (un cliente a la vez). Ver
   * migraciones 015/016 — habilitar esto solo tiene efecto si además se
   * configura tiempo_procesamiento_minutos en al menos un servicio.
   */
  capacidad_sillas: z.number().int().min(1).max(10).optional(),
});

export const updateBarberSchema = createBarberSchema.partial().extend({
  foto_url: z.string().url().nullable().optional(),
  activo:   z.boolean().optional(),  // ← esto faltaba
});

export type CreateBarberInput = z.infer<typeof createBarberSchema>;
export type UpdateBarberInput = z.infer<typeof updateBarberSchema>;

export const reorderBarbersSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export type ReorderBarbersInput = z.infer<typeof reorderBarbersSchema>;