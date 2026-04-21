import { OnInit } from '@angular/core';
import { Booking, BookingEstado } from '../../../domain/models/booking.model';
export interface CalendarDay {
    date: string;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    total: number;
}
export declare class Bookings implements OnInit {
    private readonly bookingService;
    private readonly barberService;
    private readonly toastService;
    readonly terms: any;
    readonly bookings: any;
    readonly barbers: any;
    readonly monthSummary: any;
    readonly loading: any;
    readonly loadingMonth: any;
    readonly filterEstado: any;
    readonly search: any;
    readonly selectedFecha: any;
    readonly currentYear: any;
    readonly currentMonth: any;
    readonly MESES: string[];
    readonly DIAS_HEADER: string[];
    readonly filtered: any;
    readonly calendarDays: any;
    readonly totalPendientes: any;
    readonly totalConfirmadas: any;
    ngOnInit(): void;
    private loadInitial;
    private loadMonth;
    private loadBookings;
    prevMonth(): void;
    nextMonth(): void;
    goToday(): void;
    selectDay(day: CalendarDay): void;
    updateEstado(id: string, estado: BookingEstado): void;
    onSearchInput(event: Event): void;
    onFilterChange(event: Event): void;
    getBarberNombre(barberId: string): string;
    getServiceNombre(booking: Booking): string;
    formatFecha(fecha: string): string;
    isToday(fecha: string): boolean;
}
//# sourceMappingURL=bookings.d.ts.map