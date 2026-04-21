"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const resend_client_1 = require("../../infrastructure/email/resend.client");
const booking_confirmation_1 = require("../../infrastructure/email/templates/booking-confirmation");
const booking_reminder_1 = require("../../infrastructure/email/templates/booking-reminder");
const booking_notification_1 = require("../../infrastructure/email/templates/booking-notification");
const logger_1 = require("../../infrastructure/logger");
class EmailService {
    async sendBookingConfirmation(data) {
        await resend_client_1.resend.emails.send({
            from: resend_client_1.EMAIL_FROM,
            to: data.to,
            subject: `✓ Turno confirmado en ${data.negocioNombre} — ${data.horaInicio}`,
            html: (0, booking_confirmation_1.bookingConfirmationTemplate)(data),
        });
        logger_1.logger.info("Email de confirmación enviado", {
            to: data.to,
            negocio: data.negocioNombre,
        });
    }
    async sendBookingReminder(data) {
        await resend_client_1.resend.emails.send({
            from: resend_client_1.EMAIL_FROM,
            to: data.to,
            subject: `⏰ Recordatorio: tu turno en ${data.negocioNombre} es mañana`,
            html: (0, booking_reminder_1.bookingReminderTemplate)(data),
        });
        logger_1.logger.info("Recordatorio enviado", {
            to: data.to,
            negocio: data.negocioNombre,
        });
    }
    async sendBookingNotification(data) {
        await resend_client_1.resend.emails.send({
            from: resend_client_1.EMAIL_FROM,
            to: data.to,
            subject: `Nueva reserva de ${data.clienteNombre} — ${data.horaInicio}`,
            html: (0, booking_notification_1.bookingNotificationTemplate)(data),
        });
        logger_1.logger.info("Notificación al dueño enviada", {
            to: data.to,
            negocio: data.negocioNombre,
        });
    }
    async sendPaymentConfirmation(data) {
        const fecha = new Date(data.nextBillingDate).toLocaleDateString("es-UY", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
        await resend_client_1.resend.emails.send({
            from: resend_client_1.EMAIL_FROM,
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
        logger_1.logger.info("Email de confirmación de pago enviado", { to: data.to });
    }
    async sendPaymentFailed(data) {
        await resend_client_1.resend.emails.send({
            from: resend_client_1.EMAIL_FROM,
            to: data.to,
            subject: `⚠️ Problema con tu pago — Turnio`,
            html: `
        <p>Hola <strong>${data.negocioNombre}</strong>,</p>
        <p>No pudimos procesar el pago de tu plan <strong>${data.plan}</strong>.</p>
        <p>Vamos a reintentar el cobro en los próximos días.
           Si el problema persiste, actualizá tu método de pago desde el panel.</p>
      `,
        });
        logger_1.logger.info("Email de pago fallido enviado", { to: data.to });
    }
    async sendPaymentFailedGrace(data) {
        const fecha = new Date(data.gracePeriodEndsAt).toLocaleDateString("es-UY", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
        await resend_client_1.resend.emails.send({
            from: resend_client_1.EMAIL_FROM,
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
        logger_1.logger.info("Email de período de gracia enviado", { to: data.to });
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map