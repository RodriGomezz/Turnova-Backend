import { IEmailService, BookingConfirmationPayload, BookingNotificationPayload, BookingReminderPayload, PaymentConfirmationPayload, PaymentFailedPayload, PaymentFailedGracePayload } from "../ports/IEmailService";
export declare class EmailService implements IEmailService {
    sendBookingConfirmation(data: BookingConfirmationPayload): Promise<void>;
    sendBookingReminder(data: BookingReminderPayload): Promise<void>;
    sendBookingNotification(data: BookingNotificationPayload): Promise<void>;
    sendPaymentConfirmation(data: PaymentConfirmationPayload): Promise<void>;
    sendPaymentFailed(data: PaymentFailedPayload): Promise<void>;
    sendPaymentFailedGrace(data: PaymentFailedGracePayload): Promise<void>;
}
//# sourceMappingURL=email.service.d.ts.map