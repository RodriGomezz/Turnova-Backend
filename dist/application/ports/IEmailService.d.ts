export interface BookingConfirmationPayload {
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
export interface BookingNotificationPayload {
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
export interface BookingReminderPayload {
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
export interface PaymentConfirmationPayload {
    to: string;
    negocioNombre: string;
    plan: string;
    amount: number;
    currency: string;
    nextBillingDate: string;
}
export interface PaymentFailedPayload {
    to: string;
    negocioNombre: string;
    plan: string;
}
export interface PaymentFailedGracePayload {
    to: string;
    negocioNombre: string;
    plan: string;
    gracePeriodEndsAt: string;
}
export interface IEmailService {
    sendBookingConfirmation(payload: BookingConfirmationPayload): Promise<void>;
    sendBookingNotification(payload: BookingNotificationPayload): Promise<void>;
    sendBookingReminder(payload: BookingReminderPayload): Promise<void>;
    sendPaymentConfirmation(payload: PaymentConfirmationPayload): Promise<void>;
    sendPaymentFailed(payload: PaymentFailedPayload): Promise<void>;
    sendPaymentFailedGrace(payload: PaymentFailedGracePayload): Promise<void>;
}
//# sourceMappingURL=IEmailService.d.ts.map