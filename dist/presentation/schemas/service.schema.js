"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateServiceSchema = exports.createServiceSchema = void 0;
const zod_1 = require("zod");
const serviceBaseSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).max(100).trim(),
    descripcion: zod_1.z.string().max(500).trim().optional(),
    incluye: zod_1.z.string().max(255).trim().optional(),
    duracion_minutos: zod_1.z.number().int().min(5).max(480),
    precio: zod_1.z.number().int().min(0),
    precio_hasta: zod_1.z.number().int().min(0).optional(),
});
exports.createServiceSchema = serviceBaseSchema.refine((data) => !data.precio_hasta || data.precio_hasta >= data.precio, { message: 'precio_hasta no puede ser menor que precio', path: ['precio_hasta'] });
exports.updateServiceSchema = serviceBaseSchema.partial().refine((data) => !data.precio_hasta || !data.precio || data.precio_hasta >= data.precio, { message: 'precio_hasta no puede ser menor que precio', path: ['precio_hasta'] });
//# sourceMappingURL=service.schema.js.map