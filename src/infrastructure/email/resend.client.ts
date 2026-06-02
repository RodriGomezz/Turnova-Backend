import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY no configurada');
}

if (!process.env.EMAIL_FROM) {
  throw new Error('EMAIL_FROM no configurada');
}

export const resend = new Resend(process.env.RESEND_API_KEY);
export const EMAIL_FROM = process.env.EMAIL_FROM;