// ── Emails de reservas ────────────────────────────────────────────────────────

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
  customDomain?: string | null;
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
  direccion?: string;
  whatsapp?: string;
  diasFaltantes: number;
  customDomain?: string | null;
}

export interface BookingCancellationPayload {
  to: string;
  clienteNombre: string;
  negocioNombre: string;
  servicioNombre: string;
  barberoNombre: string;
  fecha: string;
  horaInicio: string;
  reason?: string;
}

// ── Emails de suscripción ─────────────────────────────────────────────────────

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
  updatePaymentUrl?: string;
}

export interface PaymentFailedGracePayload {
  to: string;
  negocioNombre: string;
  plan: string;
  gracePeriodEndsAt: string;
  updatePaymentUrl?: string;
}

// ── Puerto ────────────────────────────────────────────────────────────────────

export interface IEmailService {
  sendBookingConfirmation(payload: BookingConfirmationPayload): Promise<void>;
  sendBookingNotification(payload: BookingNotificationPayload): Promise<void>;
  sendBookingReminder(payload: BookingReminderPayload): Promise<void>;
  sendBookingCancellation(payload: BookingCancellationPayload): Promise<void>;
  sendPaymentConfirmation(payload: PaymentConfirmationPayload): Promise<void>;
  sendPaymentFailed(payload: PaymentFailedPayload): Promise<void>;
  sendPaymentFailedGrace(payload: PaymentFailedGracePayload): Promise<void>;
}
