import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import {
  SubscriptionService,
  calcIsPro,
  calcCanUseCustomDomain,
  calcTrialDaysLeft,
} from './subscription.service';
import { environment } from '../../../environments/environment';
import { Subscription, SubscriptionState } from '../../domain/models/subscription.model';

function makeSubscription(overrides = {}): Subscription {
  return { plan: 'pro', status: 'active', current_period_end: null, grace_period_ends_at: null, dlocal_subscription_id: null, ...overrides } as Subscription;
}

function makeState(overrides = {}): SubscriptionState {
  const sub = makeSubscription();
  return { subscription: sub, activeSubscription: sub, pendingSubscription: null, ...overrides };
}

describe('SubscriptionService — HTTP', () => {
  let service: SubscriptionService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [SubscriptionService] });
    service = TestBed.inject(SubscriptionService);
    http    = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  describe('getState()', () => {
    it('hace GET a /subscriptions y devuelve el estado', () => {
      const state = makeState();
      let result: any;
      service.getState().subscribe(s => result = s);
      const req = http.expectOne(`${api}/subscriptions`);
      expect(req.request.method).toBe('GET');
      req.flush(state);
      expect(result).toEqual(state);
    });
  });

  describe('get()', () => {
    it('devuelve la activeSubscription', () => {
      const sub = makeSubscription({ plan: 'pro' });
      let result: any;
      service.get().subscribe(s => result = s);
      http.expectOne(`${api}/subscriptions`).flush(makeState({ activeSubscription: sub }));
      expect(result).toEqual(sub);
    });

    it('devuelve null si no hay suscripción activa', () => {
      let result: any = 'not-set';
      service.get().subscribe(s => result = s);
      http.expectOne(`${api}/subscriptions`).flush(makeState({ activeSubscription: null }));
      expect(result).toBeNull();
    });

    it('ignora la pendingSubscription', () => {
      let result: any = 'not-set';
      service.get().subscribe(s => result = s);
      http.expectOne(`${api}/subscriptions`).flush(makeState({ activeSubscription: null, pendingSubscription: makeSubscription({ status: 'pending' }) }));
      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    const payer = { firstName: 'Juan', lastName: 'García', email: 'j@t.com' };

    it('hace POST con plan y datos del pagador', () => {
      service.create('pro', payer).subscribe();
      const req = http.expectOne(`${api}/subscriptions/create`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ plan: 'pro', ...payer });
      req.flush({ checkoutUrl: 'https://checkout.example.com/abc' });
    });

    it('devuelve la checkoutUrl', () => {
      let url: string | undefined;
      service.create('business', payer).subscribe(u => url = u);
      http.expectOne(`${api}/subscriptions/create`).flush({ checkoutUrl: 'https://pay.com/xyz' });
      expect(url).toBe('https://pay.com/xyz');
    });

    it('funciona con plan starter', () => {
      service.create('starter', payer).subscribe();
      const req = http.expectOne(`${api}/subscriptions/create`);
      expect(req.request.body.plan).toBe('starter');
      req.flush({ checkoutUrl: 'https://checkout.com/s' });
    });
  });

  describe('cancel()', () => {
    it('hace DELETE con body confirm=true', () => {
      service.cancel().subscribe();
      const req = http.expectOne(`${api}/subscriptions/cancel`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ confirm: true });
      req.flush({ message: 'Cancelada' });
    });

    it('devuelve mensaje y currentPeriodEnd', () => {
      let result: any;
      service.cancel().subscribe(r => result = r);
      http.expectOne(`${api}/subscriptions/cancel`).flush({ message: 'Ok', currentPeriodEnd: '2024-12-31' });
      expect(result.message).toBe('Ok');
      expect(result.currentPeriodEnd).toBe('2024-12-31');
    });
  });
});

describe('subscription.service — helpers puros', () => {

  describe('calcIsPro()', () => {
    it('pro = Pro', () => expect(calcIsPro('pro', null)).toBeTrue());
    it('business = Pro', () => expect(calcIsPro('business', null)).toBeTrue());
    it('starter + trial vigente = Pro', () => expect(calcIsPro('starter', '2099-01-01T00:00:00Z')).toBeTrue());
    it('starter + trial vencido = no Pro', () => expect(calcIsPro('starter', '2020-01-01T00:00:00Z')).toBeFalse());
    it('starter sin trial = no Pro', () => expect(calcIsPro('starter', null)).toBeFalse());
    it('pro + trial vencido sigue siendo Pro', () => expect(calcIsPro('pro', '2020-01-01T00:00:00Z')).toBeTrue());
    it('futuro inmediato = Pro', () => expect(calcIsPro('starter', new Date(Date.now() + 60_000).toISOString())).toBeTrue());
    it('pasado inmediato = no Pro', () => expect(calcIsPro('starter', new Date(Date.now() - 1000).toISOString())).toBeFalse());
  });

  describe('calcCanUseCustomDomain()', () => {
    it('pro puede', () => expect(calcCanUseCustomDomain('pro')).toBeTrue());
    it('business puede', () => expect(calcCanUseCustomDomain('business')).toBeTrue());
    it('starter + trial NO puede', () => expect(calcCanUseCustomDomain('starter', '2099-01-01T00:00:00Z')).toBeFalse());
    it('starter sin trial NO puede', () => expect(calcCanUseCustomDomain('starter', null)).toBeFalse());
  });

  describe('calcTrialDaysLeft()', () => {
    it('null si no hay trial', () => expect(calcTrialDaysLeft(null)).toBeNull());
    it('positivo si vigente', () => expect(calcTrialDaysLeft(new Date(Date.now() + 7 * 86_400_000).toISOString())!).toBeGreaterThan(0));
    it('negativo si vencido', () => expect(calcTrialDaysLeft(new Date(Date.now() - 3 * 86_400_000).toISOString())!).toBeLessThanOrEqual(0));
    it('Math.ceil: 23hs = 1 día', () => expect(calcTrialDaysLeft(new Date(Date.now() + 23 * 3_600_000).toISOString())).toBe(1));
  });

});
