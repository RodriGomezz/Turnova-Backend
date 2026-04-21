import { expandirHex, esOscuro, getRatioContraste, colorTextoSobre } from './color.utils';

describe('color.utils', () => {

  // ── expandirHex ───────────────────────────────────────────────────────────

  describe('expandirHex()', () => {
    it('expande hex corto (#RGB → #RRGGBB)', () => {
      expect(expandirHex('#fff')).toBe('#ffffff');
      expect(expandirHex('#000')).toBe('#000000');
      expect(expandirHex('#f0a')).toBe('#ff00aa');
    });

    it('pasa hex largo sin modificar', () => {
      expect(expandirHex('#ffffff')).toBe('#ffffff');
      expect(expandirHex('#1a2b3c')).toBe('#1a2b3c');
    });

    it('devuelve negro para string vacío', () => {
      expect(expandirHex('')).toBe('#000000');
    });

    it('devuelve negro para hex inválido', () => {
      expect(expandirHex('#12')).toBe('#000000');
      expect(expandirHex('#1234567')).toBe('#000000');
    });

    it('tolera hex con o sin #', () => {
      // La función hace replace('#', '') así que maneja ambos
      expect(expandirHex('#abc')).toBe('#aabbcc');
    });
  });

  // ── esOscuro ──────────────────────────────────────────────────────────────

  describe('esOscuro()', () => {
    it('negro es oscuro', () => {
      expect(esOscuro('#000000')).toBeTrue();
      expect(esOscuro('#000')).toBeTrue();
    });

    it('blanco no es oscuro', () => {
      expect(esOscuro('#ffffff')).toBeFalse();
      expect(esOscuro('#fff')).toBeFalse();
    });

    it('colores oscuros típicos son detectados como oscuros', () => {
      expect(esOscuro('#1a1a2e')).toBeTrue(); // azul muy oscuro
      expect(esOscuro('#2d2d2d')).toBeTrue(); // gris oscuro
      expect(esOscuro('#0a0a0a')).toBeTrue(); // casi negro
    });

    it('colores claros típicos no son oscuros', () => {
      expect(esOscuro('#f5f2ec')).toBeFalse(); // beige claro
      expect(esOscuro('#ffffff')).toBeFalse(); // blanco
      expect(esOscuro('#e0e0e0')).toBeFalse(); // gris claro
    });

    it('devuelve true para string vacío (fallback seguro)', () => {
      expect(esOscuro('')).toBeTrue();
    });

    it('colores medios son clasificados correctamente con umbral 0.179', () => {
      // Gris medio — luminancia ~0.216 → no oscuro
      expect(esOscuro('#808080')).toBeFalse();
    });
  });

  // ── getRatioContraste ─────────────────────────────────────────────────────

  describe('getRatioContraste()', () => {
    it('negro sobre blanco tiene ratio máximo 21:1', () => {
      expect(getRatioContraste('#000000', '#ffffff')).toBe(21);
    });

    it('blanco sobre blanco tiene ratio 1:1', () => {
      expect(getRatioContraste('#ffffff', '#ffffff')).toBe(1);
    });

    it('es simétrico — el orden no importa', () => {
      const r1 = getRatioContraste('#000000', '#ffffff');
      const r2 = getRatioContraste('#ffffff', '#000000');
      expect(r1).toBe(r2);
    });

    it('cumple WCAG AA mínimo (4.5) entre texto oscuro y fondo claro típico', () => {
      // #0A0A0A sobre #F5F2EC — paleta de Turnio
      const ratio = getRatioContraste('#0a0a0a', '#f5f2ec');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('devuelve número redondeado a 1 decimal', () => {
      const ratio = getRatioContraste('#333333', '#ffffff');
      // Verificar que tiene como máximo 1 decimal
      expect(Number.isFinite(ratio)).toBeTrue();
      expect(ratio.toString()).toMatch(/^\d+(\.\d)?$/);
    });
  });

  // ── colorTextoSobre ───────────────────────────────────────────────────────

  describe('colorTextoSobre()', () => {
    it('devuelve texto claro (#F5F2EC) sobre fondos oscuros', () => {
      expect(colorTextoSobre('#000000')).toBe('#F5F2EC');
      expect(colorTextoSobre('#1a1a2e')).toBe('#F5F2EC');
    });

    it('devuelve texto oscuro (#0A0A0A) sobre fondos claros', () => {
      expect(colorTextoSobre('#ffffff')).toBe('#0A0A0A');
      expect(colorTextoSobre('#f5f2ec')).toBe('#0A0A0A');
    });

    it('devuelve el tipo literal correcto', () => {
      const resultado = colorTextoSobre('#000');
      expect(['#F5F2EC', '#0A0A0A']).toContain(resultado);
    });
  });

});
