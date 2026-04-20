import { calcIsPro, calcTrialDaysLeft } from './subscription.utils';

describe('subscription.utils', () => {

  // ── calcIsPro ─────────────────────────────────────────────────────────────

  describe('calcIsPro()', () => {

    describe('plan pagado — siempre Pro independientemente del trial', () => {
      it('plan pro sin trial = Pro', () => {
        expect(calcIsPro('pro', null)).toBeTrue();
      });

      it('plan business sin trial = Pro', () => {
        expect(calcIsPro('business', null)).toBeTrue();
      });

      it('plan pro con trial vencido = Pro (plan pagado tiene prioridad)', () => {
        expect(calcIsPro('pro', '2020-01-01T00:00:00.000Z')).toBeTrue();
      });

      it('plan business con trial vencido = Pro', () => {
        expect(calcIsPro('business', '2020-01-01T00:00:00.000Z')).toBeTrue();
      });
    });

    describe('plan starter — depende del trial', () => {
      it('starter con trial vigente = Pro', () => {
        expect(calcIsPro('starter', '2099-01-01T00:00:00.000Z')).toBeTrue();
      });

      it('starter con trial vencido = no Pro', () => {
        expect(calcIsPro('starter', '2020-01-01T00:00:00.000Z')).toBeFalse();
      });

      it('starter sin trial = no Pro', () => {
        expect(calcIsPro('starter', null)).toBeFalse();
      });

      it('starter con trial que vence exactamente ahora — borde de tiempo', () => {
        // Una fecha en el pasado inmediato
        const pasado = new Date(Date.now() - 1000).toISOString();
        expect(calcIsPro('starter', pasado)).toBeFalse();
      });

      it('starter con trial que aún no vence — futuro inmediato', () => {
        const futuro = new Date(Date.now() + 60_000).toISOString();
        expect(calcIsPro('starter', futuro)).toBeTrue();
      });
    });

    describe('planes desconocidos / edge cases', () => {
      it('plan vacío con trial vigente = Pro', () => {
        expect(calcIsPro('', '2099-01-01T00:00:00.000Z')).toBeTrue();
      });

      it('plan vacío sin trial = no Pro', () => {
        expect(calcIsPro('', null)).toBeFalse();
      });
    });

  });

  // ── calcTrialDaysLeft ─────────────────────────────────────────────────────

  describe('calcTrialDaysLeft()', () => {

    it('devuelve null si no hay trial configurado', () => {
      expect(calcTrialDaysLeft(null)).toBeNull();
    });

    it('devuelve un número positivo si el trial aún no vence', () => {
      const futuro = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = calcTrialDaysLeft(futuro);
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThan(0);
    });

    it('devuelve ~7 días para trial que vence en exactamente 7 días', () => {
      const futuro = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = calcTrialDaysLeft(futuro);
      expect(result).toBe(7);
    });

    it('devuelve número negativo o 0 si el trial ya venció', () => {
      const pasado = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = calcTrialDaysLeft(pasado);
      expect(result).not.toBeNull();
      expect(result!).toBeLessThanOrEqual(0);
    });

    it('devuelve ~1 para trial que vence mañana (Math.ceil)', () => {
      // 23 horas en el futuro → ceil a 1 día
      const manana = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
      const result = calcTrialDaysLeft(manana);
      expect(result).toBe(1);
    });

    it('devuelve número entero siempre (usa Math.ceil)', () => {
      const futuro = new Date(Date.now() + 5.5 * 24 * 60 * 60 * 1000).toISOString();
      const result = calcTrialDaysLeft(futuro);
      expect(Number.isInteger(result)).toBeTrue();
    });

  });

});
