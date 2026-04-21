import { z } from 'zod';
export declare const createBookingSchema: z.ZodObject<{
    barber_id: z.ZodString;
    service_id: z.ZodString;
    fecha: z.ZodString;
    hora_inicio: z.ZodString;
    cliente_nombre: z.ZodString;
    cliente_email: z.ZodString;
    cliente_telefono: z.ZodString;
}, z.core.$strip>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
//# sourceMappingURL=booking.schema.d.ts.map