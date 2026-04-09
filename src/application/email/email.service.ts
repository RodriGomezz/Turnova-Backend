import { resend, EMAIL_FROM } from "../../infrastructure/email/resend.client";
import { bookingConfirmationTemplate } from "../../infrastructure/email/templates/booking-confirmation";
import { bookingReminderTemplate } from "../../infrastructure/email/templates/booking-reminder";
import { bookingNotificationTemplate } from "../../infrastructure/email/templates/booking-notification";
import { logger } from "../../infrastructure/logger";
import {
  IEmailService,
  BookingConfirmationPayload,
  BookingNotificationPayload,
  BookingReminderPayload,
  PaymentConfirmationPayload,
  PaymentFailedPayload,
  PaymentFailedGracePayload,
} from "../ports/IEmailService";

export class EmailService implements IEmailService {
  async sendBookingConfirmation(data: BookingConfirmationPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `✓ Turno confirmado en ${data.negocioNombre} — ${data.horaInicio}`,
      html: bookingConfirmationTemplate(data),
    });
    logger.info("Email de confirmación enviado", {
      to: data.to,
      negocio: data.negocioNombre,
    });
  }

  async sendBookingReminder(data: BookingReminderPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `⏰ Recordatorio: tu turno en ${data.negocioNombre} es mañana`,
      html: bookingReminderTemplate(data),
    });
    logger.info("Recordatorio enviado", {
      to: data.to,
      negocio: data.negocioNombre,
    });
  }

  async sendBookingNotification(data: BookingNotificationPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `Nueva reserva de ${data.clienteNombre} — ${data.horaInicio}`,
      html: bookingNotificationTemplate(data),
    });
    logger.info("Notificación al dueño enviada", {
      to: data.to,
      negocio: data.negocioNombre,
    });
  }

  async sendPaymentConfirmation(data: PaymentConfirmationPayload): Promise<void> {
    const fecha = new Date(data.nextBillingDate).toLocaleDateString("es-UY", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `✓ Pago recibido — Plan ${data.plan} Turnio`,
      html: `
        <p>Hola <strong>${data.negocioNombre}</strong>,</p>
        <p>Tu pago de <strong>${data.currency} ${data.amount.toLocaleString("es-UY")}</strong>
           para el plan <strong>${data.plan}</strong> fue procesado correctamente.</p>
        <p>Tu próximo cobro será el <strong>${fecha}</strong>.</p>
        <p>Gracias por confiar en Turnio.</p>
      `,
    });
    logger.info("Email de confirmación de pago enviado", { to: data.to });
  }

  async sendPaymentFailed(data: PaymentFailedPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `⚠️ Problema con tu pago — Turnio`,
      html: `
        <p>Hola <strong>${data.negocioNombre}</strong>,</p>
        <p>No pudimos procesar el pago de tu plan <strong>${data.plan}</strong>.</p>
        <p>Vamos a reintentar el cobro en los próximos días.
           Si el problema persiste, actualizá tu método de pago desde el panel.</p>
      `,
    });
    logger.info("Email de pago fallido enviado", { to: data.to });
  }

  async sendPaymentFailedGrace(data: PaymentFailedGracePayload): Promise<void> {
    const fecha = new Date(data.gracePeriodEndsAt).toLocaleDateString("es-UY", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `🚨 Acción requerida — Tu plan vence el ${fecha}`,
      html: `
        <p>Hola <strong>${data.negocioNombre}</strong>,</p>
        <p>No pudimos procesar el pago de tu plan <strong>${data.plan}</strong>
           y los reintentos automáticos se agotaron.</p>
        <p>Tu cuenta permanecerá activa hasta el <strong>${fecha}</strong>.
           Después de esa fecha pasará automáticamente al plan Starter.</p>
        <p>Para mantener tu plan, actualizá tu método de pago desde el panel.</p>
      `,
    });
    logger.info("Email de período de gracia enviado", { to: data.to });
  }
}
