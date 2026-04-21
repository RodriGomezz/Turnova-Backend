"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const date_utils_1 = require("./date.utils");
describe('date.utils', () => {
    // ── toDateString ──────────────────────────────────────────────────────────
    describe('toDateString()', () => {
        it('formatea una fecha con padding correcto', () => {
            expect((0, date_utils_1.toDateString)(new Date(2024, 0, 5))).toBe('2024-01-05');
            expect((0, date_utils_1.toDateString)(new Date(2024, 11, 31))).toBe('2024-12-31');
        });
        it('usa hora local, no UTC', () => {
            // new Date(2024, 5, 1) = 1 Jun 2024 en hora local
            const result = (0, date_utils_1.toDateString)(new Date(2024, 5, 1));
            expect(result).toBe('2024-06-01');
        });
        it('maneja años bisiestos correctamente', () => {
            expect((0, date_utils_1.toDateString)(new Date(2024, 1, 29))).toBe('2024-02-29');
        });
        it('maneja año de 4 dígitos sin padding', () => {
            expect((0, date_utils_1.toDateString)(new Date(2000, 0, 1))).toBe('2000-01-01');
        });
    });
    // ── todayString ───────────────────────────────────────────────────────────
    describe('todayString()', () => {
        it('devuelve la fecha de hoy en formato YYYY-MM-DD', () => {
            const today = new Date();
            const expected = (0, date_utils_1.toDateString)(today);
            expect((0, date_utils_1.todayString)()).toBe(expected);
        });
        it('tiene el formato correcto', () => {
            expect((0, date_utils_1.todayString)()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });
    // ── currentTimeString ─────────────────────────────────────────────────────
    describe('currentTimeString()', () => {
        it('devuelve string en formato HH:MM', () => {
            expect((0, date_utils_1.currentTimeString)()).toMatch(/^\d{2}:\d{2}$/);
        });
        it('las horas están en rango 00–23', () => {
            const [hours] = (0, date_utils_1.currentTimeString)().split(':').map(Number);
            expect(hours).toBeGreaterThanOrEqual(0);
            expect(hours).toBeLessThanOrEqual(23);
        });
        it('los minutos están en rango 00–59', () => {
            const [, minutes] = (0, date_utils_1.currentTimeString)().split(':').map(Number);
            expect(minutes).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeLessThanOrEqual(59);
        });
    });
    // ── formatFechaUY ─────────────────────────────────────────────────────────
    describe('formatFechaUY()', () => {
        it('formatea una fecha en español uruguayo', () => {
            // 2024-06-15 = sábado 15 de junio (pero el día exacto puede variar por locale)
            const result = (0, date_utils_1.formatFechaUY)('2024-06-15');
            // Verificar que contiene texto en español
            expect(result.toLowerCase()).toContain('junio');
            expect(result).toContain('15');
        });
        it('incluye el día de la semana por defecto', () => {
            const result = (0, date_utils_1.formatFechaUY)('2024-01-01');
            // Lunes 1 de enero
            const diasSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
            const contieneDia = diasSemana.some(d => result.toLowerCase().includes(d));
            expect(contieneDia).toBeTrue();
        });
        it('acepta opciones de formato personalizadas', () => {
            const result = (0, date_utils_1.formatFechaUY)('2024-12-25', { year: 'numeric', month: 'long', day: 'numeric' });
            expect(result).toContain('2024');
            expect(result.toLowerCase()).toContain('diciembre');
        });
        it('parsea la fecha como hora local (00:00:00) para evitar desfase UTC', () => {
            // '2024-01-01T00:00:00' siempre es 1 de enero en hora local
            const result = (0, date_utils_1.formatFechaUY)('2024-01-01');
            expect(result).toContain('1');
            expect(result.toLowerCase()).toContain('enero');
        });
    });
});
//# sourceMappingURL=date.utils.spec.js.map