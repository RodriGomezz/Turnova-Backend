import { z } from "zod";

const faqItemSchema = z.object({
  q: z.string().min(1).max(120),
  a: z.string().min(1).max(500),
});

export const updateBusinessSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  direccion: z.string().max(200).nullable().optional(),
  buffer_minutos: z.number().int().min(0).max(60).optional(),
  /**
   * Cada cuántos minutos se ofrece un horario de inicio en el buscador de
   * turnos, independiente de la duración del servicio. Mismos topes que
   * la columna en BD (024_add_intervalo_turnos.sql). Se valida contra un
   * set cerrado de valores típicos del rubro (mismo criterio que Fresha/
   * Calendly) en vez de aceptar cualquier entero — evita que alguien
   * cargue, por error de tipeo, un intervalo de 3 minutos que generaría
   * una grilla de horarios enorme e inútil.
   */
  intervalo_turnos_minutos: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
    z.literal(120),
  ]).optional(),
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
  horario_texto: z.string().max(200).nullable().optional(),
  /** true = usar horario_texto tal cual; false/undefined = generar el texto desde schedules. */
  horario_personalizado: z.boolean().optional(),
  fotos_galeria: z.array(z.string().url()).max(8).nullable().optional(),
  faq_items: z.array(faqItemSchema).max(8).nullable().optional(),
  dias_anticipacion: z.number().int().min(1).max(365).optional(), 
  recordatorio_horas_antes: z.number().int().min(1).max(72).optional(),
  ciudad: z.string().max(50).nullable().optional(),
  pais: z.string().max(50).nullable().optional(),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
