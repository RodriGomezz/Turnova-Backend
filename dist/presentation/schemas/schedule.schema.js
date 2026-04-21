"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlockedDateSchema = exports.updateScheduleSchema = exports.createScheduleSchema = void 0;
const zod_1 = require("zod");
exports.createScheduleSchema = zod_1.z.object({
    dia_semana: zod_1.z.number().int().min(0).max(6),
    hora_inicio: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:MM)'),
    hora_fin: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido (HH:MM)'),
    barber_id: zod_1.z.string().uuid().optional(),
}).refine((data) => data.hora_inicio < data.hora_fin, { message: 'hora_fin debe ser mayor que hora_inicio', path: ['hora_fin'] });
exports.updateScheduleSchema = zod_1.z.object({
    hora_inicio: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    hora_fin: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    activo: zod_1.z.boolean().optional(),
}).refine((data) => {
    if (data.hora_inicio && data.hora_fin) {
        return data.hora_inicio < data.hora_fin;
    }
    return true;
}, { message: 'hora_fin debe ser mayor que hora_inicio', path: ['hora_fin'] });
exports.createBlockedDateSchema = zod_1.z.object({
    fecha: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)"),
    fecha_fin: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)")
        .optional(),
    motivo: zod_1.z.string().max(255).trim().optional(),
    barber_id: zod_1.z.string().uuid().optional(),
});
//# sourceMappingURL=schedule.schema.js.map