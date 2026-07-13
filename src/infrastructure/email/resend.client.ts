import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY no configurada');
}

if (!process.env.EMAIL_FROM) {
  throw new Error('EMAIL_FROM no configurada');
}

export const resend = new Resend(process.env.RESEND_API_KEY);
export const EMAIL_FROM = process.env.EMAIL_FROM;

// EMAIL_FROM viene como "Kronu <no-reply@kronu.pro>". Para los emails que
// el cliente final recibe (confirmación, recordatorio, cancelación) es
// mejor que el remitente muestre el nombre del negocio en vez de "Kronu" —
// así el cliente reconoce quién le escribe, aunque la dirección real siga
// siendo la misma (no-reply@kronu.pro, el dominio verificado en Resend).
const FROM_ADDRESS = EMAIL_FROM.match(/<(.+)>/)?.[1] ?? EMAIL_FROM;

export function businessEmailFrom(negocioNombre: string): string {
  // Comillas dobles en el display name evitan que un nombre con caracteres
  // raros (comas, &, etc.) rompa el header From. Escapamos comillas propias
  // del nombre para no romper esas comillas del wrapper.
  const safeName = negocioNombre.replace(/"/g, "'");
  return `"${safeName}" <${FROM_ADDRESS}>`;
}