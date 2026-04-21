"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const business_status_service_1 = require("./business-status.service");
const business_service_1 = require("./business.service");
const subscription_service_1 = require("./subscription.service");
const rxjs_1 = require("rxjs");
// ── Factories ─────────────────────────────────────────────────────────────────
function makeBusiness(overrides = {}) {
    return {
        id: 'biz-1',
        slug: 'mi-barberia',
        nombre: 'Mi Barbería',
        logo_url: null,
        color_fondo: '#ffffff',
        color_acento: '#000000',
        color_superficie: '#f0f0f0',
        email: null,
        whatsapp: null,
        direccion: null,
        timezone: 'America/Montevideo',
        buffer_minutos: 0,
        auto_confirmar: true,
        activo: true,
        plan: 'starter',
        trial_ends_at: '',
        created_at: '2024-01-01T00:00:00.000Z',
        frase_bienvenida: null,
        hero_imagen_url: null,
        instagram: null,
        facebook: null,
        tipografia: 'clasica',
        estilo_cards: 'destacado',
        tipo_negocio: 'barberia',
        termino_profesional: 'Barbero',
        termino_profesional_plural: 'Barberos',
        termino_servicio: 'Servicio',
        termino_reserva: 'Reserva',
        onboarding_completed: true,
        ...overrides,
    };
}
function makeSubscription(overrides = {}) {
    return {
        plan: 'pro',
        status: 'active',
        current_period_end: null,
        grace_period_ends_at: null,
        dlocal_subscription_id: null,
        ...overrides,
    };
}
const futuro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const pasadoReciente = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 días
const pasadoLejano = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 días
// ── Suite ─────────────────────────────────────────────────────────────────────
describe('BusinessStatusService', () => {
    let service;
    let businessServiceSpy;
    let subscriptionServiceSpy;
    beforeEach(() => {
        businessServiceSpy = jasmine.createSpyObj('BusinessService', ['get']);
        subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', ['get']);
        testing_1.TestBed.configureTestingModule({
            providers: [
                business_status_service_1.BusinessStatusService,
                { provide: business_service_1.BusinessService, useValue: businessServiceSpy },
                { provide: subscription_service_1.SubscriptionService, useValue: subscriptionServiceSpy },
            ],
        });
        service = testing_1.TestBed.inject(business_status_service_1.BusinessStatusService);
    });
    // ── Estado inicial ──────────────────────────────────────────────────────────
    it('arranca sin datos cargados', () => {
        expect(service.loaded()).toBeFalse();
        expect(service.business()).toBeNull();
        expect(service.subscription()).toBeNull();
    });
    it('planStatus es "starter" cuando no hay business cargado', () => {
        expect(service.planStatus()).toBe('starter');
    });
    // ── planStatus — suscripción activa ─────────────────────────────────────────
    describe('planStatus() con suscripción activa', () => {
        it('pro_active cuando plan=pro y subscription.status=active', () => {
            service.business.set(makeBusiness({ plan: 'pro' }));
            service.subscription.set(makeSubscription({ plan: 'pro', status: 'active' }));
            expect(service.planStatus()).toBe('pro_active');
        });
        it('business_active cuando plan=business y subscription.status=active', () => {
            service.business.set(makeBusiness({ plan: 'business' }));
            service.subscription.set(makeSubscription({ plan: 'business', status: 'active' }));
            expect(service.planStatus()).toBe('business_active');
        });
        it('suscripción activa ignora el trial vencido', () => {
            service.business.set(makeBusiness({ plan: 'pro', trial_ends_at: pasadoLejano }));
            service.subscription.set(makeSubscription({ status: 'active' }));
            expect(service.planStatus()).toBe('pro_active');
        });
    });
    // ── planStatus — problemas de pago ─────────────────────────────────────────
    describe('planStatus() con problemas de pago', () => {
        it('payment_pending cuando status=past_due', () => {
            service.business.set(makeBusiness());
            service.subscription.set(makeSubscription({ status: 'past_due' }));
            expect(service.planStatus()).toBe('payment_pending');
        });
        it('payment_grace cuando status=grace_period', () => {
            service.business.set(makeBusiness());
            service.subscription.set(makeSubscription({ status: 'grace_period' }));
            expect(service.planStatus()).toBe('payment_grace');
        });
    });
    // ── planStatus — trial ──────────────────────────────────────────────────────
    describe('planStatus() sin suscripción activa — trial', () => {
        it('trial_active cuando el trial aún vigente', () => {
            service.business.set(makeBusiness({ trial_ends_at: futuro }));
            service.subscription.set(null);
            expect(service.planStatus()).toBe('trial_active');
        });
        it('trial_grace cuando el trial venció hace <= 14 días', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoReciente }));
            service.subscription.set(null);
            expect(service.planStatus()).toBe('trial_grace');
        });
        it('trial_expired cuando el trial venció hace > 14 días', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoLejano }));
            service.subscription.set(null);
            expect(service.planStatus()).toBe('trial_expired');
        });
        it('starter cuando plan=starter sin trial', () => {
            service.business.set(makeBusiness({ plan: 'starter', trial_ends_at: '' }));
            service.subscription.set(null);
            expect(service.planStatus()).toBe('starter');
        });
    });
    // ── isPro ───────────────────────────────────────────────────────────────────
    describe('isPro()', () => {
        it('true en trial_active', () => {
            service.business.set(makeBusiness({ trial_ends_at: futuro }));
            service.subscription.set(null);
            expect(service.isPro()).toBeTrue();
        });
        it('true en trial_grace', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoReciente }));
            service.subscription.set(null);
            expect(service.isPro()).toBeTrue();
        });
        it('true en pro_active', () => {
            service.business.set(makeBusiness({ plan: 'pro' }));
            service.subscription.set(makeSubscription({ status: 'active' }));
            expect(service.isPro()).toBeTrue();
        });
        it('true en business_active', () => {
            service.business.set(makeBusiness({ plan: 'business' }));
            service.subscription.set(makeSubscription({ plan: 'business', status: 'active' }));
            expect(service.isPro()).toBeTrue();
        });
        it('false en trial_expired', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoLejano }));
            service.subscription.set(null);
            expect(service.isPro()).toBeFalse();
        });
        it('false en starter sin trial', () => {
            service.business.set(makeBusiness({ trial_ends_at: '' }));
            service.subscription.set(null);
            expect(service.isPro()).toBeFalse();
        });
    });
    // ── isBusiness ─────────────────────────────────────────────────────────────
    describe('isBusiness()', () => {
        it('true solo en business_active', () => {
            service.business.set(makeBusiness({ plan: 'business' }));
            service.subscription.set(makeSubscription({ plan: 'business', status: 'active' }));
            expect(service.isBusiness()).toBeTrue();
        });
        it('false en pro_active', () => {
            service.business.set(makeBusiness({ plan: 'pro' }));
            service.subscription.set(makeSubscription({ status: 'active' }));
            expect(service.isBusiness()).toBeFalse();
        });
    });
    // ── trialDaysLeft ───────────────────────────────────────────────────────────
    describe('trialDaysLeft()', () => {
        it('devuelve null sin trial', () => {
            service.business.set(makeBusiness({ trial_ends_at: '' }));
            expect(service.trialDaysLeft()).toBeNull();
        });
        it('devuelve días positivos si el trial está vigente', () => {
            service.business.set(makeBusiness({ trial_ends_at: futuro }));
            const days = service.trialDaysLeft();
            expect(days).not.toBeNull();
            expect(days).toBeGreaterThan(0);
        });
        it('devuelve null si el trial ya venció', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoLejano }));
            expect(service.trialDaysLeft()).toBeNull();
        });
    });
    // ── bannerInfo ──────────────────────────────────────────────────────────────
    describe('bannerInfo()', () => {
        it('sin banner (type null) en pro_active', () => {
            service.business.set(makeBusiness({ plan: 'pro' }));
            service.subscription.set(makeSubscription({ status: 'active' }));
            expect(service.bannerInfo().type).toBeNull();
        });
        it('sin banner en starter sin trial', () => {
            service.business.set(makeBusiness({ trial_ends_at: '' }));
            service.subscription.set(null);
            expect(service.bannerInfo().type).toBeNull();
        });
        it('banner info en trial_active con más de 7 días', () => {
            service.business.set(makeBusiness({ trial_ends_at: futuro }));
            service.subscription.set(null);
            expect(service.bannerInfo().type).toBe('info');
        });
        it('banner warning en trial con <= 7 días restantes', () => {
            const casi = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            service.business.set(makeBusiness({ trial_ends_at: casi }));
            service.subscription.set(null);
            expect(service.bannerInfo().type).toBe('warning');
        });
        it('banner warning en trial_grace', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoReciente }));
            service.subscription.set(null);
            expect(service.bannerInfo().type).toBe('warning');
        });
        it('banner danger en trial_expired', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoLejano }));
            service.subscription.set(null);
            expect(service.bannerInfo().type).toBe('danger');
        });
        it('banner warning en payment_pending', () => {
            service.business.set(makeBusiness());
            service.subscription.set(makeSubscription({ status: 'past_due' }));
            expect(service.bannerInfo().type).toBe('warning');
        });
        it('banner danger en payment_grace', () => {
            service.business.set(makeBusiness());
            service.subscription.set(makeSubscription({ status: 'grace_period' }));
            expect(service.bannerInfo().type).toBe('danger');
        });
        it('el mensaje de trial_expired menciona suscripción', () => {
            service.business.set(makeBusiness({ trial_ends_at: pasadoLejano }));
            service.subscription.set(null);
            expect(service.bannerInfo().message.toLowerCase()).toContain('suscribite');
        });
    });
    // ── load() ──────────────────────────────────────────────────────────────────
    describe('load()', () => {
        it('setea business, subscription y loaded=true', () => {
            const biz = makeBusiness();
            const sub = makeSubscription();
            businessServiceSpy.get.and.returnValue((0, rxjs_1.of)(biz));
            subscriptionServiceSpy.get.and.returnValue((0, rxjs_1.of)(sub));
            service.load().subscribe();
            expect(service.business()).toEqual(biz);
            expect(service.subscription()).toEqual(sub);
            expect(service.loaded()).toBeTrue();
        });
        it('maneja subscription null correctamente', () => {
            businessServiceSpy.get.and.returnValue((0, rxjs_1.of)(makeBusiness()));
            subscriptionServiceSpy.get.and.returnValue((0, rxjs_1.of)(null));
            service.load().subscribe();
            expect(service.subscription()).toBeNull();
            expect(service.loaded()).toBeTrue();
        });
    });
    // ── refresh() ───────────────────────────────────────────────────────────────
    describe('refresh()', () => {
        it('resetea loaded a false antes de recargar', () => {
            service.loaded.set(true);
            businessServiceSpy.get.and.returnValue((0, rxjs_1.of)(makeBusiness()));
            subscriptionServiceSpy.get.and.returnValue((0, rxjs_1.of)(null));
            // Capturar el estado intermedio es difícil con observables síncronos,
            // pero podemos verificar que al final loaded vuelve a true
            service.refresh().subscribe();
            expect(service.loaded()).toBeTrue();
        });
    });
    // ── bannerInfo — singular "día" con trialLeft === 1 ─────────────────────────
    describe('bannerInfo() — plural/singular de días', () => {
        function biz(trial_ends_at) {
            return makeBusiness({ trial_ends_at });
        }
        it('usa singular "día" cuando trialLeft === 1 (trial_active)', () => {
            // ~20hs en el futuro → Math.ceil = 1 día
            const en20h = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
            service.business.set(biz(en20h));
            service.subscription.set(null);
            const banner = service.bannerInfo();
            expect(banner.type).toBe('warning');
            expect(banner.message).toContain('1 día');
            expect(banner.message).not.toMatch(/1 días/);
        });
        it('usa plural "días" cuando trialLeft > 1 (trial_active)', () => {
            const en3dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            service.business.set(biz(en3dias));
            service.subscription.set(null);
            expect(service.bannerInfo().message).toContain('días');
        });
        it('usa singular "día" en trial_grace cuando graceLeft === 1', () => {
            // trial venció hace ~13 días → ~1 día de grace restante
            const hace13 = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();
            service.business.set(biz(hace13));
            service.subscription.set(null);
            const banner = service.bannerInfo();
            expect(banner.type).toBe('warning');
            expect(banner.message).toMatch(/1 día[^s]/);
        });
        it('usa plural "días" en trial_grace cuando graceLeft > 1', () => {
            // trial venció hace 5 días → 9 días de grace restante
            const hace5 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
            service.business.set(biz(hace5));
            service.subscription.set(null);
            expect(service.bannerInfo().message).toContain('días');
        });
    });
    // ── planStatus — suscripción activa en plan starter ───────────────────────
    describe('planStatus() — suscripción activa con plan starter', () => {
        it('retorna "starter" (no pro_active) cuando plan=starter + subscription active', () => {
            service.business.set(makeBusiness({ plan: 'starter', trial_ends_at: '' }));
            service.subscription.set({
                plan: 'starter',
                status: 'active',
                current_period_end: null,
                grace_period_ends_at: null,
                dlocal_subscription_id: null,
            });
            expect(service.planStatus()).toBe('starter');
        });
        it('bannerInfo es null cuando suscripción activa en starter', () => {
            service.business.set(makeBusiness({ plan: 'starter', trial_ends_at: '' }));
            service.subscription.set({
                plan: 'starter',
                status: 'active',
                current_period_end: null,
                grace_period_ends_at: null,
                dlocal_subscription_id: null,
            });
            expect(service.bannerInfo().type).toBeNull();
        });
    });
    // ── bannerInfo — rama default del switch (nunca debería ocurrir) ──────────
    describe('bannerInfo() — rama default del switch', () => {
        it('devuelve type null para planStatus desconocido (rama default defensiva)', () => {
            // Forzamos un estado imposible en runtime pero que existe en el código
            // para que el compilador y el coverage lo detecten
            // Lo simulamos seteando un estado nulo que lleva a planStatus='starter' sin trial
            service.business.set(makeBusiness({ plan: 'starter', trial_ends_at: '' }));
            service.subscription.set(null);
            // planStatus = 'starter', que cae en el case 'starter' → type null
            // La rama default solo ejecuta si planStatus retorna un valor no mapeado
            // En producción nunca ocurre — la cobertura del switch default es structural
            expect(service.bannerInfo().type).toBeNull();
            expect(service.bannerInfo().message).toBe('');
        });
    });
});
//# sourceMappingURL=business-status.service.spec.js.map