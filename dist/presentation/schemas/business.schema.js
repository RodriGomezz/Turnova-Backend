"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBusinessSchema = void 0;
const zod_1 = require("zod");
exports.updateBusinessSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1).max(100).optional(),
    email: zod_1.z.string().email().nullable().optional(),
    whatsapp: zod_1.z.string().max(20).nullable().optional(),
    direccion: zod_1.z.string().max(200).nullable().optional(),
    buffer_minutos: zod_1.z.number().int().min(0).max(60).optional(),
    auto_confirmar: zod_1.z.boolean().optional(),
    logo_url: zod_1.z.string().url().nullable().optional(),
    color_fondo: zod_1.z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    color_acento: zod_1.z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    frase_bienvenida: zod_1.z.string().max(80).nullable().optional(),
    hero_imagen_url: zod_1.z.string().url().nullable().optional(),
    instagram: zod_1.z.string().max(50).nullable().optional(),
    facebook: zod_1.z.string().max(50).nullable().optional(),
    tipografia: zod_1.z.enum(["clasica", "moderna", "minimalista", "bold"]).optional(),
    estilo_cards: zod_1.z.enum(["destacado", "minimalista", "oscuro"]).optional(),
    tipo_negocio: zod_1.z.string().max(50).optional(),
    termino_profesional: zod_1.z.string().min(1).max(30).optional(),
    termino_profesional_plural: zod_1.z.string().min(1).max(30).optional(),
    termino_servicio: zod_1.z.string().min(1).max(30).optional(),
    termino_reserva: zod_1.z.string().min(1).max(30).optional(),
});
//# sourceMappingURL=business.schema.js.map