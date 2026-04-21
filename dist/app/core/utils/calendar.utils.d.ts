export interface CalendarDay {
    date: string;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isPast: boolean;
}
export interface CalendarDayWithCount extends CalendarDay {
    total: number;
}
export interface CalendarDayWithAvailability extends CalendarDay {
    available: boolean;
}
/**
 * Calendario para el panel de reservas — muestra conteo por día.
 */
export declare function buildBookingsCalendar(year: number, month: number, summary: {
    fecha: string;
    total: number;
}[], selectedDate: string): CalendarDayWithCount[];
/**
 * Calendario para la página pública de reservas — muestra disponibilidad.
 */
export declare function buildAvailabilityCalendar(year: number, month: number, availableDays: string[]): CalendarDayWithAvailability[];
//# sourceMappingURL=calendar.utils.d.ts.map