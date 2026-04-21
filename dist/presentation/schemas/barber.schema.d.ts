import { z } from 'zod';
export declare const createBarberSchema: z.ZodObject<{
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    orden: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateBarberSchema: z.ZodObject<{
    nombre: z.ZodOptional<z.ZodString>;
    descripcion: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    orden: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    foto_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type CreateBarberInput = z.infer<typeof createBarberSchema>;
export type UpdateBarberInput = z.infer<typeof updateBarberSchema>;
//# sourceMappingURL=barber.schema.d.ts.map