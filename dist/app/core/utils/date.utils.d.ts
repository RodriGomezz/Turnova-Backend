/**
 * Convierte un Date a string 'YYYY-MM-DD' en hora local.
 * Centraliza la lógica duplicada en dashboard, bookings y booking.
 */
export declare function toDateString(date: Date): string;
export declare function todayString(): string;
/**
 * Hora actual como string 'HH:MM'.
 * Centraliza la lógica duplicada en dashboard y booking.
 */
export declare function currentTimeString(): string;
/**
 * Formatea una fecha 'YYYY-MM-DD' al formato local uruguayo.
 * Centraliza formatFecha() duplicado en dashboard y bookings.
 */
export declare function formatFechaUY(fecha: string, options?: Intl.DateTimeFormatOptions): string;
//# sourceMappingURL=date.utils.d.ts.map