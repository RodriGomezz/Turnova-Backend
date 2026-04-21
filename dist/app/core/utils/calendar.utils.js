"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBookingsCalendar = buildBookingsCalendar;
exports.buildAvailabilityCalendar = buildAvailabilityCalendar;
// src/app/core/utils/calendar.utils.ts
const date_utils_1 = require("./date.utils");
/**
 * Genera las 42 celdas (6 semanas) para un mes dado.
 * Semana empieza en lunes (índice 0 = lunes).
 */
function buildMonthGrid(year, month) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const cells = [];
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0)
        startDow = 6;
    for (let i = startDow - 1; i >= 0; i--) {
        cells.push(new Date(year, month - 1, -i));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
        cells.push(new Date(year, month - 1, d));
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        cells.push(new Date(year, month, d));
    }
    return cells;
}
/**
 * Calendario para el panel de reservas — muestra conteo por día.
 */
function buildBookingsCalendar(year, month, summary, selectedDate) {
    const today = (0, date_utils_1.todayString)();
    const currentMonthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
    const currentMonthEnd = `${year}-${month.toString().padStart(2, '0')}-31`;
    return buildMonthGrid(year, month).map((date) => {
        const dateStr = (0, date_utils_1.toDateString)(date);
        const isCurrentMonth = dateStr >= currentMonthStart && dateStr <= currentMonthEnd
            ? date.getMonth() === month - 1
            : false;
        return {
            date: dateStr,
            day: date.getDate(),
            isCurrentMonth: date.getMonth() === month - 1,
            isToday: dateStr === today,
            isSelected: dateStr === selectedDate,
            isPast: dateStr < today,
            total: summary.find((s) => s.fecha === dateStr)?.total ?? 0,
        };
    });
}
/**
 * Calendario para la página pública de reservas — muestra disponibilidad.
 */
function buildAvailabilityCalendar(year, month, availableDays) {
    const today = (0, date_utils_1.todayString)();
    return buildMonthGrid(year, month).map((date) => {
        const dateStr = (0, date_utils_1.toDateString)(date);
        return {
            date: dateStr,
            day: date.getDate(),
            isCurrentMonth: date.getMonth() === month - 1,
            isToday: dateStr === today,
            isSelected: false,
            isPast: dateStr < today,
            available: availableDays.includes(dateStr),
        };
    });
}
//# sourceMappingURL=calendar.utils.js.map