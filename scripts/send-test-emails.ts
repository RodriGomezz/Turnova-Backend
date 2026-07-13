/**
 * Manda los 6 templates de verdad, vía Resend, a tu propio email.
 * Esto es lo que importa de verdad esta semana: confirma que Resend está
 * bien configurado (dominio verificado, EMAIL_FROM correcto) y te deja ver
 * el render real en Gmail/Outlook/Apple Mail — no una aproximación.
 *
 * Uso:
 *   TEST_EMAIL=tu@email.com npx ts-node scripts/send-test-emails.ts
 *
 * Requiere que RESEND_API_KEY y EMAIL_FROM ya estén en tu .env
 */

import dotenv from "dotenv";
dotenv.config();

import { resend, EMAIL_FROM } from "../src/infrastructure/email/resend.client";
import { bookingConfirmationTemplate } from "../src/infrastructure/email/templates/booking-confirmation";
import { bookingReminderTemplate } from "../src/infrastructure/email/templates/booking-reminder";
import { bookingNotificationTemplate } from "../src/infrastructure/email/templates/booking-notification";
import { bookingCancellationTemplate } from "../src/infrastructure/email/templates/booking-cancellation";
import { paymentConfirmationTemplate } from "../src/infrastructure/email/templates/payment-confirmation";
import { paymentFailedTemplate } from "../src/infrastructure/email/templates/payment-failed";
import { paymentFailedGraceTemplate } from "../src/infrastructure/email/templates/payment-failed-grace";

const to = process.env.TEST_EMAIL;
if (!to) {
  console.error("Falta TEST_EMAIL. Uso: TEST_EMAIL=tu@email.com npx ts-node scripts/send-test-emails.ts");
  process.exit(1);
}

async function main() {
  const sends = [
    {
      subject: "[TEST] Turno confirmado",
      html: bookingConfirmationTemplate({
        clienteNombre: "Martín Suárez",
        negocioNombre: "Barbería El Corte",
        servicioNombre: "Corte + Barba",
        barberoNombre: "Nico",
        fecha: "2026-07-18",
        horaInicio: "15:30",
        cancellationToken: "abc123token",
        slug: "el-corte",
      }),
    },
    {
      subject: "[TEST] Recordatorio de turno",
      html: bookingReminderTemplate({
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
    },
    {
      subject: "[TEST] Nueva reserva (dueño)",
      html: bookingNotificationTemplate({
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
    },
    {
      subject: "[TEST] Turno cancelado",
      html: bookingCancellationTemplate({
        clienteNombre: "Martín Suárez",
        negocioNombre: "Barbería El Corte",
        servicioNombre: "Corte + Barba",
        barberoNombre: "Nico",
        fecha: "2026-07-18",
        horaInicio: "15:30",
        reason: "El barbero tuvo un imprevisto",
      }),
    },
    {
      subject: "[TEST] Pago recibido",
      html: paymentConfirmationTemplate({
        negocioNombre: "Barbería El Corte",
        amount: 1490,
        currency: "UYU",
        plan: "Pro",
        nextBillingDate: "2026-08-12",
      }),
    },
    {
      subject: "[TEST] Problema con tu pago",
      html: paymentFailedTemplate({
        negocioNombre: "Barbería El Corte",
        plan: "Pro",
        updatePaymentUrl: "https://app.kronu.pro/el-corte/billing",
      }),
    },
    {
      subject: "[TEST] Acción requerida (período de gracia)",
      html: paymentFailedGraceTemplate({
        negocioNombre: "Barbería El Corte",
        plan: "Pro",
        gracePeriodEndsAt: "2026-07-20",
        updatePaymentUrl: "https://app.kronu.pro/el-corte/billing",
      }),
    },
  ];

  for (const { subject, html } of sends) {
    const result = await resend.emails.send({ from: EMAIL_FROM, to: to!, subject, html });
    console.log(`✓ enviado: ${subject}`, result);
    // Pequeña pausa para no pegarle en ráfaga a la API de Resend
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nListo. Revisá tu inbox (y la carpeta de spam, primera vez que puede pasar).");
}

main().catch((err) => {
  console.error("Error enviando test emails:", err);
  process.exit(1);
});
