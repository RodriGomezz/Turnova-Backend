/**
 * Genera un .html por cada template con datos mock, para abrir en el navegador
 * y revisar diseño rápido sin gastar envíos de Resend.
 *
 * Uso: npx ts-node scripts/preview-emails.ts
 * (o compilá con tsc y corré con node si no tenés ts-node instalado)
 *
 * Los archivos quedan en /preview-output — abrilos con doble click.
 * OJO: esto muestra cómo se ve en un navegador (Chrome/Firefox), que usa un
 * motor de render moderno. NO es lo mismo que Outlook desktop, que usa el
 * motor de Word para renderizar HTML y es mucho más limitado. Para eso
 * hace falta el paso 2 (envío real) o un servicio como Litmus/Email on Acid.
 */

import * as fs from "fs";
import * as path from "path";

import { bookingConfirmationTemplate } from "../src/infrastructure/email/templates/booking-confirmation";
import { bookingReminderTemplate } from "../src/infrastructure/email/templates/booking-reminder";
import { bookingNotificationTemplate } from "../src/infrastructure/email/templates/booking-notification";
import { bookingCancellationTemplate } from "../src/infrastructure/email/templates/booking-cancellation";
import { paymentConfirmationTemplate } from "../src/infrastructure/email/templates/payment-confirmation";
import { paymentFailedTemplate } from "../src/infrastructure/email/templates/payment-failed";
import { paymentFailedGraceTemplate } from "../src/infrastructure/email/templates/payment-failed-grace";

const OUT_DIR = path.join(__dirname, "..", "preview-output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const templates: Record<string, string> = {
  "booking-confirmation": bookingConfirmationTemplate({
    clienteNombre: "Martín Suárez",
    negocioNombre: "Barbería El Corte",
    servicioNombre: "Corte + Barba",
    barberoNombre: "Nico",
    fecha: "2026-07-18",
    horaInicio: "15:30",
    cancellationToken: "abc123token",
    slug: "el-corte",
  }),

  "booking-reminder": bookingReminderTemplate({
    clienteNombre: "Martín Suárez",
    negocioNombre: "Barbería El Corte",
    servicioNombre: "Corte + Barba",
    barberoNombre: "Nico",
    fecha: "2026-07-18",
    horaInicio: "15:30",
    cancellationToken: "abc123token",
    slug: "el-corte",
    direccion: "Bulevar Artigas 1234",
    whatsapp: "59899123456",
    diasFaltantes: 1,
  }),

  "booking-notification": bookingNotificationTemplate({
    negocioNombre: "Barbería El Corte",
    clienteNombre: "Martín Suárez",
    clienteEmail: "martin@example.com",
    clienteTelefono: "099123456",
    servicioNombre: "Corte + Barba",
    barberoNombre: "Nico",
    fecha: "2026-07-18",
    horaInicio: "15:30",
    horaFin: "16:00",
  }),

  "booking-cancellation": bookingCancellationTemplate({
    clienteNombre: "Martín Suárez",
    negocioNombre: "Barbería El Corte",
    servicioNombre: "Corte + Barba",
    barberoNombre: "Nico",
    fecha: "2026-07-18",
    horaInicio: "15:30",
    reason: "El barbero tuvo un imprevisto",
  }),

  "payment-confirmation": paymentConfirmationTemplate({
    negocioNombre: "Barbería El Corte",
    amount: 1490,
    currency: "UYU",
    plan: "Pro",
    nextBillingDate: "2026-08-12",
  }),

  "payment-failed": paymentFailedTemplate({
    negocioNombre: "Barbería El Corte",
    plan: "Pro",
    updatePaymentUrl: "https://app.kronu.pro/el-corte/billing",
  }),

  "payment-failed-grace": paymentFailedGraceTemplate({
    negocioNombre: "Barbería El Corte",
    plan: "Pro",
    gracePeriodEndsAt: "2026-07-20",
    updatePaymentUrl: "https://app.kronu.pro/el-corte/billing",
  }),
};

for (const [name, html] of Object.entries(templates)) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html`), html);
  console.log(`✓ ${name}.html`);
}

console.log(`\nListo. Abrí los archivos en /preview-output con el navegador.`);
