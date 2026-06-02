import { z } from 'zod';

const strongPasswordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(100, 'La contraseña no puede superar los 100 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
  .regex(/\d/, 'La contraseña debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir un símbolo')
  .refine((value) => !/\s/.test(value), 'La contraseña no puede contener espacios');

export const registerSchema = z.object({
  nombre:                     z.string().min(2).max(100).trim(),
  email:                      z.string().email().toLowerCase().trim(),
  password:                   strongPasswordSchema,
  nombre_negocio:             z.string().min(2).max(100).trim(),
  slug:                       z.string().min(2).max(100).toLowerCase().trim()
                                .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  tipo_negocio:               z.string().optional(),
  termino_profesional:        z.string().optional(),
  termino_profesional_plural: z.string().optional(),
  termino_servicio:           z.string().optional(),
  termino_reserva:            z.string().optional(),
}).superRefine((data, ctx) => {
  const emailName = data.email.split('@')[0]?.toLowerCase();

  if (
    emailName &&
    emailName.length >= 4 &&
    data.password.toLowerCase().includes(emailName)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['password'],
      message: 'La contraseña no puede contener parte del email',
    });
  }
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const resendConfirmationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendConfirmationInput = z.infer<typeof resendConfirmationSchema>;
