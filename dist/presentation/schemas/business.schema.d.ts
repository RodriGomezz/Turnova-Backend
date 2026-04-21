import { z } from "zod";
export declare const updateBusinessSchema: z.ZodObject<{
    nombre: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    whatsapp: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    direccion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    buffer_minutos: z.ZodOptional<z.ZodNumber>;
    auto_confirmar: z.ZodOptional<z.ZodBoolean>;
    logo_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color_fondo: z.ZodOptional<z.ZodString>;
    color_acento: z.ZodOptional<z.ZodString>;
    frase_bienvenida: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hero_imagen_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    instagram: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    facebook: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tipografia: z.ZodOptional<z.ZodEnum<{
        bold: "bold";
        clasica: "clasica";
        moderna: "moderna";
        minimalista: "minimalista";
    }>>;
    estilo_cards: z.ZodOptional<z.ZodEnum<{
        minimalista: "minimalista";
        destacado: "destacado";
        oscuro: "oscuro";
    }>>;
    tipo_negocio: z.ZodOptional<z.ZodString>;
    termino_profesional: z.ZodOptional<z.ZodString>;
    termino_profesional_plural: z.ZodOptional<z.ZodString>;
    termino_servicio: z.ZodOptional<z.ZodString>;
    termino_reserva: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
//# sourceMappingURL=business.schema.d.ts.map