import { z } from 'zod';

const serviceBaseSchema = z.object({
  nombre: z.string().min(2).max(100).trim(),
  descripcion: z.string().max(500).trim().optional(),
  incluye: z.string().max(255).trim().optional(),
  duracion_minutos: z.number().int().min(5).max(480),
  precio: z.number().int().min(0),
  precio_hasta: z.number().int().min(0).optional(),
});

export const createServiceSchema = serviceBaseSchema.refine(
  (data) => !data.precio_hasta || data.precio_hasta >= data.precio,
  { message: 'precio_hasta no puede ser menor que precio', path: ['precio_hasta'] }
);

export const updateServiceSchema = serviceBaseSchema.partial().refine(
  (data) => !data.precio_hasta || !data.precio || data.precio_hasta >= data.precio,
  { message: 'precio_hasta no puede ser menor que precio', path: ['precio_hasta'] }
);

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;