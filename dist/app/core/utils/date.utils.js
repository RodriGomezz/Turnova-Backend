"use strict";
// src/app/core/utils/date.utils.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDateString = toDateString;
exports.todayString = todayString;
exports.currentTimeString = currentTimeString;
exports.formatFechaUY = formatFechaUY;
/**
 * Convierte un Date a string 'YYYY-MM-DD' en hora local.
 * Centraliza la lógica duplicada en dashboard, bookings y booking.
 */
function toDateString(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function todayString() {
    return toDateString(new Date());
}
/**
 * Hora actual como string 'HH:MM'.
 * Centraliza la lógica duplicada en dashboard y booking.
 */
function currentTimeString() {
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
function formatFechaUY(fecha, options = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
}) {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-UY', options);
}
//# sourceMappingURL=date.utils.js.map