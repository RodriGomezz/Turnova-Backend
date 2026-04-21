"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).max(100).trim(),
    email: zod_1.z.string().email().toLowerCase().trim(),
    password: zod_1.z.string().min(8).max(100),
    nombre_negocio: zod_1.z.string().min(2).max(100).trim(),
    slug: zod_1.z.string().min(2).max(100).toLowerCase().trim()
        .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
    tipo_negocio: zod_1.z.string().optional(),
    termino_profesional: zod_1.z.string().optional(),
    termino_profesional_plural: zod_1.z.string().optional(),
    termino_servicio: zod_1.z.string().optional(),
    termino_reserva: zod_1.z.string().optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase().trim(),
    password: zod_1.z.string().min(1),
});
//# sourceMappingURL=auth.schema.js.map