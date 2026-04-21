"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const calendar_utils_1 = require("./calendar.utils");
const date_utils_1 = require("./date.utils");
describe('calendar.utils', () => {
    // ── Fixtures ──────────────────────────────────────────────────────────────
    // Enero 2024: empieza lunes 1 → el grid no necesita relleno al inicio
    const YEAR = 2024;
    const MONTH_ENERO = 1;
    const MONTH_JUNIO = 6; // Junio 2024: empieza sábado → 5 días de relleno al inicio
    // ── buildBookingsCalendar ─────────────────────────────────────────────────
    describe('buildBookingsCalendar()', () => {
        it('siempre genera exactamente 42 celdas (6 semanas)', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            expect(grid.length).toBe(42);
        });
        it('genera 42 celdas también para meses con relleno', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_JUNIO, [], '2024-06-15');
            expect(grid.length).toBe(42);
        });
        it('todas las celdas tienen formato de fecha YYYY-MM-DD', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            grid.forEach(cell => {
                expect(cell.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            });
        });
        it('los días del mes corriente tienen isCurrentMonth = true', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            const enero = grid.filter(c => c.date >= '2024-01-01' && c.date <= '2024-01-31');
            enero.forEach(cell => expect(cell.isCurrentMonth).toBeTrue());
        });
        it('las celdas de relleno (otros meses) tienen isCurrentMonth = false', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_JUNIO, [], '2024-06-15');
            const otrosMeses = grid.filter(c => {
                const month = parseInt(c.date.split('-')[1], 10);
                return month !== MONTH_JUNIO;
            });
            otrosMeses.forEach(cell => expect(cell.isCurrentMonth).toBeFalse());
        });
        it('marca correctamente el día seleccionado', () => {
            const selected = '2024-01-15';
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], selected);
            const selectedCell = grid.find(c => c.date === selected);
            expect(selectedCell?.isSelected).toBeTrue();
            const otrosDias = grid.filter(c => c.date !== selected);
            otrosDias.forEach(c => expect(c.isSelected).toBeFalse());
        });
        it('asigna total=0 para días sin reservas', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            grid.forEach(cell => expect(cell.total).toBe(0));
        });
        it('asigna el total correcto desde el summary', () => {
            const summary = [
                { fecha: '2024-01-10', total: 5 },
                { fecha: '2024-01-20', total: 3 },
            ];
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, summary, '2024-01-01');
            const dia10 = grid.find(c => c.date === '2024-01-10');
            const dia20 = grid.find(c => c.date === '2024-01-20');
            expect(dia10?.total).toBe(5);
            expect(dia20?.total).toBe(3);
        });
        it('isToday es true solo para la fecha actual', () => {
            const today = (0, date_utils_1.todayString)();
            const [year, month] = today.split('-').map(Number);
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(year, month, [], today);
            const todayCell = grid.find(c => c.date === today);
            if (todayCell) {
                expect(todayCell.isToday).toBeTrue();
            }
        });
        it('las fechas anteriores a hoy tienen isPast = true', () => {
            const today = (0, date_utils_1.todayString)();
            const [year, month] = today.split('-').map(Number);
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(year, month, [], today);
            grid.filter(c => c.date < today).forEach(c => {
                expect(c.isPast).toBeTrue();
            });
        });
        it('la fecha de hoy no es past', () => {
            const today = (0, date_utils_1.todayString)();
            const [year, month] = today.split('-').map(Number);
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(year, month, [], today);
            const todayCell = grid.find(c => c.date === today);
            if (todayCell) {
                expect(todayCell.isPast).toBeFalse();
            }
        });
        it('contiene el primer día del mes', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            expect(grid.some(c => c.date === '2024-01-01')).toBeTrue();
        });
        it('contiene el último día del mes', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            expect(grid.some(c => c.date === '2024-01-31')).toBeTrue();
        });
        it('el campo day coincide con el día del mes', () => {
            const grid = (0, calendar_utils_1.buildBookingsCalendar)(YEAR, MONTH_ENERO, [], '2024-01-01');
            const dia15 = grid.find(c => c.date === '2024-01-15');
            expect(dia15?.day).toBe(15);
        });
    });
    // ── buildAvailabilityCalendar ─────────────────────────────────────────────
    describe('buildAvailabilityCalendar()', () => {
        it('siempre genera exactamente 42 celdas', () => {
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(YEAR, MONTH_ENERO, []);
            expect(grid.length).toBe(42);
        });
        it('available = false para todos los días si no hay disponibilidad', () => {
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(YEAR, MONTH_ENERO, []);
            grid.forEach(c => expect(c.available).toBeFalse());
        });
        it('marca como available los días que están en el array', () => {
            const available = ['2024-01-08', '2024-01-15', '2024-01-22'];
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(YEAR, MONTH_ENERO, available);
            available.forEach(fecha => {
                const cell = grid.find(c => c.date === fecha);
                expect(cell?.available).toBeTrue();
            });
        });
        it('días no disponibles tienen available = false aunque estén en el mes', () => {
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(YEAR, MONTH_ENERO, ['2024-01-10']);
            const noDisponibles = grid.filter(c => c.date !== '2024-01-10' && c.isCurrentMonth);
            noDisponibles.forEach(c => expect(c.available).toBeFalse());
        });
        it('isSelected siempre es false (no se selecciona en el calendario de disponibilidad)', () => {
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(YEAR, MONTH_ENERO, ['2024-01-10']);
            grid.forEach(c => expect(c.isSelected).toBeFalse());
        });
        it('los días pasados tienen isPast = true', () => {
            const today = (0, date_utils_1.todayString)();
            const [year, month] = today.split('-').map(Number);
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(year, month, []);
            grid.filter(c => c.date < today).forEach(c => {
                expect(c.isPast).toBeTrue();
            });
        });
        it('genera el mes de febrero en año bisiesto correctamente', () => {
            // Febrero 2024 — 29 días
            const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(2024, 2, []);
            expect(grid.some(c => c.date === '2024-02-29')).toBeTrue();
        });
    });
});
// ── Branch: startDow < 0 — mes que empieza en domingo ─────────────────────────
// getDay() devuelve 0 para domingo → startDow = 0 - 1 = -1 → debe corregirse a 6
describe('calendar.utils — branch startDow para mes que empieza en domingo', () => {
    it('buildBookingsCalendar sigue generando 42 celdas cuando el mes empieza en domingo', () => {
        // Septiembre 2024 empieza en domingo (getDay() = 0)
        const grid = (0, calendar_utils_1.buildBookingsCalendar)(2024, 9, [], '2024-09-01');
        expect(grid.length).toBe(42);
        expect(grid.some(c => c.date === '2024-09-01')).toBeTrue();
        expect(grid.some(c => c.date === '2024-09-30')).toBeTrue();
    });
    it('buildAvailabilityCalendar sigue generando 42 celdas para mes en domingo', () => {
        const grid = (0, calendar_utils_1.buildAvailabilityCalendar)(2024, 9, []);
        expect(grid.length).toBe(42);
    });
    it('buildBookingsCalendar para diciembre 2024 (empieza domingo) es correcto', () => {
        // Diciembre 2024 empieza domingo
        const grid = (0, calendar_utils_1.buildBookingsCalendar)(2024, 12, [], '2024-12-01');
        expect(grid.length).toBe(42);
        expect(grid.some(c => c.date === '2024-12-31')).toBeTrue();
    });
});
//# sourceMappingURL=calendar.utils.spec.js.map