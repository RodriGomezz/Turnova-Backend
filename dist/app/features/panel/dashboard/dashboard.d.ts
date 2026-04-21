import { OnInit } from '@angular/core';
import { Booking, BookingEstado } from '../../../domain/models/booking.model';
export declare class Dashboard implements OnInit {
    private readonly bookingService;
    private readonly businessService;
    private readonly statusService;
    private readonly toastService;
    readonly terms: any;
    readonly loading: any;
    readonly bookings: any;
    readonly daySummary: any;
    readonly autoConfirmar: any;
    readonly excedeLimit: any;
    readonly maxBarberos: any;
    readonly selectedFecha: any;
    readonly showOnboarding: any;
    readonly isPro: any;
    readonly trialDaysLeft: any;
    private readonly business;
    readonly resumen: any;
    readonly barbersSummary: any;
    readonly businessSlug: any;
    /**
     * Primera reserva pendiente o confirmada que aún no comenzó.
     * Solo relevante cuando selectedFecha es hoy.
     */
    readonly proximaReserva: any;
    ngOnInit(): void;
    loadData(): void;
    onOnboardingCompleted(): void;
    onOnboardingSkipped(): void;
    changeDate(offset: number): void;
    goToToday(): void;
    updateEstado(id: string, estado: BookingEstado): void;
    copyPublicLink(): void;
    isToday(): boolean;
    isPast(booking: Booking): boolean;
    getBarberNombre(barberId: string): string;
    getServiceNombre(booking: Booking): string;
    formatFecha(fecha: string): string;
    getOcupacionLabel(pct: number): string;
    getOcupacionColor(pct: number): string;
}
//# sourceMappingURL=dashboard.d.ts.map