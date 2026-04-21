"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBookingSchema = void 0;
const zod_1 = require("zod");
exports.createBookingSchema = zod_1.z.object({
    barber_id: zod_1.z.string().uuid(),
    service_id: zod_1.z.string().uuid(),
    fecha: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
    hora_inicio: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
    cliente_nombre: zod_1.z.string().min(2).max(100).trim(),
    cliente_email: zod_1.z.string().email().toLowerCase().trim(),
    cliente_telefono: zod_1.z.string().regex(/^09\d{7}$/, 'Teléfono uruguayo inválido (09XXXXXXX)'),
});
//# sourceMappingURL=booking.schema.js.map