"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const testing_2 = require("@angular/common/http/testing");
const subscription_service_1 = require("./subscription.service");
const environment_1 = require("../../../environments/environment");
function makeSubscription(overrides = {}) {
    return { plan: 'pro', status: 'active', current_period_end: null, grace_period_ends_at: null, dlocal_subscription_id: null, ...overrides };
}
function makeState(overrides = {}) {
    const sub = makeSubscription();
    return { subscription: sub, activeSubscription: sub, pendingSubscription: null, ...overrides };
}
describe('SubscriptionService — HTTP', () => {
    let service;
    let http;
    const api = environment_1.environment.apiUrl;
    beforeEach(() => {
        testing_1.TestBed.configureTestingModule({ imports: [testing_2.HttpClientTestingModule], providers: [subscription_service_1.SubscriptionService] });
        service = testing_1.TestBed.inject(subscription_service_1.SubscriptionService);
        http = testing_1.TestBed.inject(testing_2.HttpTestingController);
    });
    afterEach(() => http.verify());
    describe('getState()', () => {
        it('hace GET a /subscriptions y devuelve el estado', () => {
            const state = makeState();
            let result;
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
            let result;
            service.get().subscribe(s => result = s);
            http.expectOne(`${api}/subscriptions`).flush(makeState({ activeSubscription: sub }));
            expect(result).toEqual(sub);
        });
        it('devuelve null si no hay suscripción activa', () => {
            let result = 'not-set';
            service.get().subscribe(s => result = s);
            http.expectOne(`${api}/subscriptions`).flush(makeState({ activeSubscription: null }));
            expect(result).toBeNull();
        });
        it('ignora la pendingSubscription', () => {
            let result = 'not-set';
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
            let url;
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
            let result;
            service.cancel().subscribe(r => result = r);
            http.expectOne(`${api}/subscriptions/cancel`).flush({ message: 'Ok', currentPeriodEnd: '2024-12-31' });
            expect(result.message).toBe('Ok');
            expect(result.currentPeriodEnd).toBe('2024-12-31');
        });
    });
});
describe('subscription.service — helpers puros', () => {
    describe('calcIsPro()', () => {
        it('pro = Pro', () => expect((0, subscription_service_1.calcIsPro)('pro', null)).toBeTrue());
        it('business = Pro', () => expect((0, subscription_service_1.calcIsPro)('business', null)).toBeTrue());
        it('starter + trial vigente = Pro', () => expect((0, subscription_service_1.calcIsPro)('starter', '2099-01-01T00:00:00Z')).toBeTrue());
        it('starter + trial vencido = no Pro', () => expect((0, subscription_service_1.calcIsPro)('starter', '2020-01-01T00:00:00Z')).toBeFalse());
        it('starter sin trial = no Pro', () => expect((0, subscription_service_1.calcIsPro)('starter', null)).toBeFalse());
        it('pro + trial vencido sigue siendo Pro', () => expect((0, subscription_service_1.calcIsPro)('pro', '2020-01-01T00:00:00Z')).toBeTrue());
        it('futuro inmediato = Pro', () => expect((0, subscription_service_1.calcIsPro)('starter', new Date(Date.now() + 60000).toISOString())).toBeTrue());
        it('pasado inmediato = no Pro', () => expect((0, subscription_service_1.calcIsPro)('starter', new Date(Date.now() - 1000).toISOString())).toBeFalse());
    });
    describe('calcCanUseCustomDomain()', () => {
        it('pro puede', () => expect((0, subscription_service_1.calcCanUseCustomDomain)('pro')).toBeTrue());
        it('business puede', () => expect((0, subscription_service_1.calcCanUseCustomDomain)('business')).toBeTrue());
        it('starter + trial NO puede', () => expect((0, subscription_service_1.calcCanUseCustomDomain)('starter', '2099-01-01T00:00:00Z')).toBeFalse());
        it('starter sin trial NO puede', () => expect((0, subscription_service_1.calcCanUseCustomDomain)('starter', null)).toBeFalse());
    });
    describe('calcTrialDaysLeft()', () => {
        it('null si no hay trial', () => expect((0, subscription_service_1.calcTrialDaysLeft)(null)).toBeNull());
        it('positivo si vigente', () => expect((0, subscription_service_1.calcTrialDaysLeft)(new Date(Date.now() + 7 * 86400000).toISOString())).toBeGreaterThan(0));
        it('negativo si vencido', () => expect((0, subscription_service_1.calcTrialDaysLeft)(new Date(Date.now() - 3 * 86400000).toISOString())).toBeLessThanOrEqual(0));
        it('Math.ceil: 23hs = 1 día', () => expect((0, subscription_service_1.calcTrialDaysLeft)(new Date(Date.now() + 23 * 3600000).toISOString())).toBe(1));
    });
});
//# sourceMappingURL=subscription.service.spec.js.map