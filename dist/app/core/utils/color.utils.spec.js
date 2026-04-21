"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const color_utils_1 = require("./color.utils");
describe('color.utils', () => {
    // ── expandirHex ───────────────────────────────────────────────────────────
    describe('expandirHex()', () => {
        it('expande hex corto (#RGB → #RRGGBB)', () => {
            expect((0, color_utils_1.expandirHex)('#fff')).toBe('#ffffff');
            expect((0, color_utils_1.expandirHex)('#000')).toBe('#000000');
            expect((0, color_utils_1.expandirHex)('#f0a')).toBe('#ff00aa');
        });
        it('pasa hex largo sin modificar', () => {
            expect((0, color_utils_1.expandirHex)('#ffffff')).toBe('#ffffff');
            expect((0, color_utils_1.expandirHex)('#1a2b3c')).toBe('#1a2b3c');
        });
        it('devuelve negro para string vacío', () => {
            expect((0, color_utils_1.expandirHex)('')).toBe('#000000');
        });
        it('devuelve negro para hex inválido', () => {
            expect((0, color_utils_1.expandirHex)('#12')).toBe('#000000');
            expect((0, color_utils_1.expandirHex)('#1234567')).toBe('#000000');
        });
        it('tolera hex con o sin #', () => {
            // La función hace replace('#', '') así que maneja ambos
            expect((0, color_utils_1.expandirHex)('#abc')).toBe('#aabbcc');
        });
    });
    // ── esOscuro ──────────────────────────────────────────────────────────────
    describe('esOscuro()', () => {
        it('negro es oscuro', () => {
            expect((0, color_utils_1.esOscuro)('#000000')).toBeTrue();
            expect((0, color_utils_1.esOscuro)('#000')).toBeTrue();
        });
        it('blanco no es oscuro', () => {
            expect((0, color_utils_1.esOscuro)('#ffffff')).toBeFalse();
            expect((0, color_utils_1.esOscuro)('#fff')).toBeFalse();
        });
        it('colores oscuros típicos son detectados como oscuros', () => {
            expect((0, color_utils_1.esOscuro)('#1a1a2e')).toBeTrue(); // azul muy oscuro
            expect((0, color_utils_1.esOscuro)('#2d2d2d')).toBeTrue(); // gris oscuro
            expect((0, color_utils_1.esOscuro)('#0a0a0a')).toBeTrue(); // casi negro
        });
        it('colores claros típicos no son oscuros', () => {
            expect((0, color_utils_1.esOscuro)('#f5f2ec')).toBeFalse(); // beige claro
            expect((0, color_utils_1.esOscuro)('#ffffff')).toBeFalse(); // blanco
            expect((0, color_utils_1.esOscuro)('#e0e0e0')).toBeFalse(); // gris claro
        });
        it('devuelve true para string vacío (fallback seguro)', () => {
            expect((0, color_utils_1.esOscuro)('')).toBeTrue();
        });
        it('colores medios son clasificados correctamente con umbral 0.179', () => {
            // Gris medio — luminancia ~0.216 → no oscuro
            expect((0, color_utils_1.esOscuro)('#808080')).toBeFalse();
        });
    });
    // ── getRatioContraste ─────────────────────────────────────────────────────
    describe('getRatioContraste()', () => {
        it('negro sobre blanco tiene ratio máximo 21:1', () => {
            expect((0, color_utils_1.getRatioContraste)('#000000', '#ffffff')).toBe(21);
        });
        it('blanco sobre blanco tiene ratio 1:1', () => {
            expect((0, color_utils_1.getRatioContraste)('#ffffff', '#ffffff')).toBe(1);
        });
        it('es simétrico — el orden no importa', () => {
            const r1 = (0, color_utils_1.getRatioContraste)('#000000', '#ffffff');
            const r2 = (0, color_utils_1.getRatioContraste)('#ffffff', '#000000');
            expect(r1).toBe(r2);
        });
        it('cumple WCAG AA mínimo (4.5) entre texto oscuro y fondo claro típico', () => {
            // #0A0A0A sobre #F5F2EC — paleta de Turnio
            const ratio = (0, color_utils_1.getRatioContraste)('#0a0a0a', '#f5f2ec');
            expect(ratio).toBeGreaterThanOrEqual(4.5);
        });
        it('devuelve número redondeado a 1 decimal', () => {
            const ratio = (0, color_utils_1.getRatioContraste)('#333333', '#ffffff');
            // Verificar que tiene como máximo 1 decimal
            expect(Number.isFinite(ratio)).toBeTrue();
            expect(ratio.toString()).toMatch(/^\d+(\.\d)?$/);
        });
    });
    // ── colorTextoSobre ───────────────────────────────────────────────────────
    describe('colorTextoSobre()', () => {
        it('devuelve texto claro (#F5F2EC) sobre fondos oscuros', () => {
            expect((0, color_utils_1.colorTextoSobre)('#000000')).toBe('#F5F2EC');
            expect((0, color_utils_1.colorTextoSobre)('#1a1a2e')).toBe('#F5F2EC');
        });
        it('devuelve texto oscuro (#0A0A0A) sobre fondos claros', () => {
            expect((0, color_utils_1.colorTextoSobre)('#ffffff')).toBe('#0A0A0A');
            expect((0, color_utils_1.colorTextoSobre)('#f5f2ec')).toBe('#0A0A0A');
        });
        it('devuelve el tipo literal correcto', () => {
            const resultado = (0, color_utils_1.colorTextoSobre)('#000');
            expect(['#F5F2EC', '#0A0A0A']).toContain(resultado);
        });
    });
});
//# sourceMappingURL=color.utils.spec.js.map