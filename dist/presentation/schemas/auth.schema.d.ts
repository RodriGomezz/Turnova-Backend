import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    nombre: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    nombre_negocio: z.ZodString;
    slug: z.ZodString;
    tipo_negocio: z.ZodOptional<z.ZodString>;
    termino_profesional: z.ZodOptional<z.ZodString>;
    termino_profesional_plural: z.ZodOptional<z.ZodString>;
    termino_servicio: z.ZodOptional<z.ZodString>;
    termino_reserva: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
//# sourceMappingURL=auth.schema.d.ts.map