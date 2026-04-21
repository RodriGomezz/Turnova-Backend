interface BookingReminderData {
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
}
export declare function bookingReminderTemplate(data: BookingReminderData): string;
export {};
//# sourceMappingURL=booking-reminder.d.ts.map