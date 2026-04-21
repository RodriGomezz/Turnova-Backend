export type BookingEstado = 'pendiente' | 'confirmada' | 'cancelada';
export interface Booking {
    id: string;
    business_id: string;
    barber_id: string;
    service_id: string;
    cliente_nombre: string;
    cliente_email: string;
    cliente_telefono: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    estado: BookingEstado;
    cancellation_token: string;
    reminder_sent_at: string | null;
    created_at: string;
    barbers?: {
        nombre: string;
    };
    services?: {
        nombre: string;
        duracion_minutos: number;
    };
}
export interface TimeSlot {
    hora_inicio: string;
    hora_fin: string;
    disponible: boolean;
}
//# sourceMappingURL=booking.model.d.ts.map