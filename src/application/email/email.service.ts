import { resend, EMAIL_FROM } from "../../infrastructure/email/resend.client";
import { bookingConfirmationTemplate } from "../../infrastructure/email/templates/booking-confirmation";
import { bookingReminderTemplate } from "../../infrastructure/email/templates/booking-reminder";
import { bookingNotificationTemplate } from "../../infrastructure/email/templates/booking-notification";
import { bookingCancellationTemplate } from "../../infrastructure/email/templates/booking-cancellation";
import { paymentConfirmationTemplate } from "../../infrastructure/email/templates/payment-confirmation";
import { paymentFailedTemplate } from "../../infrastructure/email/templates/payment-failed";
import { paymentFailedGraceTemplate } from "../../infrastructure/email/templates/payment-failed-grace";
import { logger } from "../../infrastructure/logger";
import {
  IEmailService,
  BookingConfirmationPayload,
  BookingNotificationPayload,
  BookingReminderPayload,
  BookingCancellationPayload,
  PaymentConfirmationPayload,
  PaymentFailedPayload,
  PaymentFailedGracePayload,
} from "../ports/IEmailService";

export class EmailService implements IEmailService {
  async sendBookingConfirmation(data: BookingConfirmationPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `Turno confirmado en ${data.negocioNombre} - ${data.horaInicio}`,
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
      subject: `Recordatorio: tu turno en ${data.negocioNombre} es mañana`,
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

  async sendBookingCancellation(data: BookingCancellationPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `Tu turno en ${data.negocioNombre} fue cancelado`,
      html: bookingCancellationTemplate(data),
    });
    logger.info("Email de cancelación enviado", {
      to: data.to,
      negocio: data.negocioNombre,
    });
  }

  async sendPaymentConfirmation(data: PaymentConfirmationPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `Pago recibido — Plan ${data.plan} Kronu`,
      html: paymentConfirmationTemplate(data),
    });
    logger.info("Email de confirmación de pago enviado", { to: data.to });
  }

  async sendPaymentFailed(data: PaymentFailedPayload): Promise<void> {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `Problema con tu pago — Kronu`,
      html: paymentFailedTemplate(data),
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
      subject: `Acción requerida — Tu plan vence el ${fecha}`,
      html: paymentFailedGraceTemplate(data),
    });
    logger.info("Email de período de gracia enviado", { to: data.to });
  }
}
