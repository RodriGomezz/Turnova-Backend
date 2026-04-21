import { z } from 'zod';
export declare const createServiceSchema: z.ZodObject<{
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    incluye: z.ZodOptional<z.ZodString>;
    duracion_minutos: z.ZodNumber;
    precio: z.ZodNumber;
    precio_hasta: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateServiceSchema: z.ZodObject<{
    nombre: z.ZodOptional<z.ZodString>;
    descripcion: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    incluye: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    duracion_minutos: z.ZodOptional<z.ZodNumber>;
    precio: z.ZodOptional<z.ZodNumber>;
    precio_hasta: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
//# sourceMappingURL=service.schema.d.ts.map