// src/app/core/utils/date.utils.ts

/**
 * Convierte un Date a string 'YYYY-MM-DD' en hora local.
 * Centraliza la lógica duplicada en dashboard, bookings y booking.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

/**
 * Hora actual como string 'HH:MM'.
 * Centraliza la lógica duplicada en dashboard y booking.
 */
export function currentTimeString(): string {
  const now = new Date();
  return [
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
  ].join(':');
}

/**
 * Formatea una fecha 'YYYY-MM-DD' al formato local uruguayo.
 * Centraliza formatFecha() duplicado en dashboard y bookings.
 */
export function formatFechaUY(
  fecha: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  },
): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-UY', options);
}
