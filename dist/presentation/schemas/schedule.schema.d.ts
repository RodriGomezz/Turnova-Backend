import { z } from 'zod';
export declare const createScheduleSchema: z.ZodObject<{
    dia_semana: z.ZodNumber;
    hora_inicio: z.ZodString;
    hora_fin: z.ZodString;
    barber_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateScheduleSchema: z.ZodObject<{
    hora_inicio: z.ZodOptional<z.ZodString>;
    hora_fin: z.ZodOptional<z.ZodString>;
    activo: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const createBlockedDateSchema: z.ZodObject<{
    fecha: z.ZodString;
    fecha_fin: z.ZodOptional<z.ZodString>;
    motivo: z.ZodOptional<z.ZodString>;
    barber_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;
//# sourceMappingURL=schedule.schema.d.ts.map