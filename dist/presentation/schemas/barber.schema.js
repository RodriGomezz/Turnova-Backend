"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBarberSchema = exports.createBarberSchema = void 0;
const zod_1 = require("zod");
exports.createBarberSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).max(100).trim(),
    descripcion: zod_1.z.string().max(500).trim().optional(),
    orden: zod_1.z.number().int().min(0).optional(),
});
exports.updateBarberSchema = exports.createBarberSchema.partial().extend({
    foto_url: zod_1.z.string().url().nullable().optional(),
});
//# sourceMappingURL=barber.schema.js.map