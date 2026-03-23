import { z } from "zod";

export const updateBusinessSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  direccion: z.string().max(200).nullable().optional(),
  buffer_minutos: z.number().int().min(0).max(60).optional(),
  auto_confirmar: z.boolean().optional(),
  logo_url: z.string().url().nullable().optional(),
  color_fondo: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  color_acento: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  frase_bienvenida: z.string().max(80).nullable().optional(),
  hero_imagen_url: z.string().url().nullable().optional(),
  instagram: z.string().max(50).nullable().optional(),
  facebook: z.string().max(50).nullable().optional(),
  tipografia: z.enum(["clasica", "moderna", "minimalista", "bold"]).optional(),
  estilo_cards: z.enum(["destacado", "minimalista", "oscuro"]).optional(),
  tipo_negocio: z.string().max(50).optional(),
  termino_profesional: z.string().min(1).max(30).optional(),
  termino_profesional_plural: z.string().min(1).max(30).optional(),
  termino_servicio: z.string().min(1).max(30).optional(),
  termino_reserva: z.string().min(1).max(30).optional(),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
