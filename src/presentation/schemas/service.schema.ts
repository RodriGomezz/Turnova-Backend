import { z } from 'zod';

const serviceBaseSchema = z.object({
  nombre: z.string().min(2).max(100).trim(),
  descripcion: z.string().max(500).trim().optional(),
  incluye: z.string().max(255).trim().optional(),
  duracion_minutos: z.number().int().min(5).max(480),
  precio: z.number().int().min(0),
  precio_hasta: z.number().int().min(0).optional(),
  /**
   * Minutos de atención activa al inicio (ej. aplicar el color). Omitido =
   * todo el servicio es activo (comportamiento actual). Solo tiene efecto
   * real si el barbero asignado tiene capacidad_sillas > 1 — ver migración 016.
   */
  tiempo_activo_inicial_minutos: z.number().int().min(0).max(480).optional(),
  /** Minutos sin atención (ej. color fraguando). Omitido = 0, sin cambios. */
  tiempo_procesamiento_minutos: z.number().int().min(0).max(480).optional(),
});

export const createServiceSchema = serviceBaseSchema
  .refine(
    (data) => !data.precio_hasta || data.precio_hasta >= data.precio,
    { message: 'precio_hasta no puede ser menor que precio', path: ['precio_hasta'] }
  )
  .refine(
    (data) =>
      (data.tiempo_activo_inicial_minutos ?? 0) + (data.tiempo_procesamiento_minutos ?? 0) <=
      data.duracion_minutos,
    {
      message: 'tiempo_activo_inicial_minutos + tiempo_procesamiento_minutos no puede superar duracion_minutos',
      path: ['tiempo_procesamiento_minutos'],
    },
  );

export const updateServiceSchema = serviceBaseSchema
  .partial()
  .refine(
    (data) => !data.precio_hasta || !data.precio || data.precio_hasta >= data.precio,
    { message: 'precio_hasta no puede ser menor que precio', path: ['precio_hasta'] }
  )
  .refine(
    (data) =>
      data.duracion_minutos == null ||
      (data.tiempo_activo_inicial_minutos ?? 0) + (data.tiempo_procesamiento_minutos ?? 0) <=
        data.duracion_minutos,
    {
      message: 'tiempo_activo_inicial_minutos + tiempo_procesamiento_minutos no puede superar duracion_minutos',
      path: ['tiempo_procesamiento_minutos'],
    },
  );

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const reorderServicesSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export type ReorderServicesInput = z.infer<typeof reorderServicesSchema>;