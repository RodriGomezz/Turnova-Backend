import { resend, EMAIL_FROM } from "../../infrastructure/email/resend.client";
import { bookingConfirmationTemplate } from "../../infrastructure/email/templates/booking-confirmation";
import { bookingReminderTemplate } from "../../infrastructure/email/templates/booking-reminder";
import { bookingNotificationTemplate } from "../../infrastructure/email/templates/booking-notification";
import { logger } from "../../infrastructure/logger";

interface BookingConfirmationData {
  to: string;
  clienteNombre: string;
  negocioNombre: string;
  servicioNombre: string;
  barberoNombre: string;
  fecha: string;
  horaInicio: string;
  cancellationToken: string;
  slug: string;
}

interface BookingReminderData extends BookingConfirmationData {
  direccion?: string;
  whatsapp?: string;
}

interface BookingNotificationData {
  to: string;
  negocioNombre: string;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  servicioNombre: string;
  barberoNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export class EmailService {
  async sendBookingConfirmation(data: BookingConfirmationData): Promise<void> {
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

  async sendBookingReminder(data: BookingReminderData): Promise<void> {
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

  async sendBookingNotification(data: BookingNotificationData): Promise<void> {
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
}
