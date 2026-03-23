import { z } from 'zod';

export const registerSchema = z.object({
  nombre:                     z.string().min(2).max(100).trim(),
  email:                      z.string().email().toLowerCase().trim(),
  password:                   z.string().min(8).max(100),
  nombre_negocio:             z.string().min(2).max(100).trim(),
  slug:                       z.string().min(2).max(100).toLowerCase().trim()
                                .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  tipo_negocio:               z.string().optional(),
  termino_profesional:        z.string().optional(),
  termino_profesional_plural: z.string().optional(),
  termino_servicio:           z.string().optional(),
  termino_reserva:            z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;