"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
const router_1 = require("@angular/router");
const config_1 = require("./config");
const business_service_1 = require("../../../core/services/business.service");
const business_status_service_1 = require("../../../core/services/business-status.service");
const storage_service_1 = require("../../../core/services/storage.service");
const auth_service_1 = require("../../../core/services/auth.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
const domain_service_1 = require("../../../core/services/domain.service");
const subscription_service_1 = require("../../../core/services/subscription.service");
function makeBusiness(overrides = {}) {
    return {
        id: 'biz-1',
        slug: 'test0',
        nombre: 'Test 0',
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
        termino_reserva: 'Turno',
        onboarding_completed: true,
        ...overrides,
    };
}
function makeSubscription(overrides = {}) {
    return {
        plan: 'pro',
        status: 'active',
        current_period_end: '2026-05-20T00:00:00.000Z',
        grace_period_ends_at: null,
        dlocal_subscription_id: 'sub-1',
        ...overrides,
    };
}
describe('Config', () => {
    let component;
    let domainServiceSpy;
    let toastServiceSpy;
    let subscriptionServiceSpy;
    let statusBusiness;
    let statusTrialDaysLeft;
    beforeEach(async () => {
        domainServiceSpy = jasmine.createSpyObj('DomainService', [
            'get',
            'add',
            'remove',
            'checkStatus',
        ]);
        toastServiceSpy = jasmine.createSpyObj('ToastService', [
            'success',
            'error',
            'info',
            'warning',
        ]);
        subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', [
            'getState',
            'create',
            'cancel',
        ]);
        statusBusiness = (0, core_1.signal)(makeBusiness());
        statusTrialDaysLeft = (0, core_1.signal)(null);
        domainServiceSpy.get.and.returnValue((0, rxjs_1.of)({
            custom_domain: null,
            domain_verified: false,
            domain_verified_at: null,
            domain_added_at: null,
        }));
        subscriptionServiceSpy.getState.and.returnValue((0, rxjs_1.of)({
            subscription: null,
            activeSubscription: null,
            pendingSubscription: null,
        }));
        await testing_1.TestBed.configureTestingModule({
            imports: [config_1.Config],
            providers: [
                {
                    provide: business_service_1.BusinessService,
                    useValue: jasmine.createSpyObj('BusinessService', [
                        'get',
                        'update',
                        'getStatus',
                        'deactivateBranch',
                        'reactivateBranch',
                        'deleteBranch',
                    ]),
                },
                {
                    provide: business_status_service_1.BusinessStatusService,
                    useValue: {
                        business: statusBusiness,
                        trialDaysLeft: statusTrialDaysLeft,
                        refresh: () => (0, rxjs_1.of)(void 0),
                    },
                },
                {
                    provide: storage_service_1.StorageService,
                    useValue: jasmine.createSpyObj('StorageService', ['uploadBusinessAsset']),
                },
                {
                    provide: auth_service_1.AuthService,
                    useValue: jasmine.createSpyObj('AuthService', [
                        'me',
                        'updateProfile',
                        'createBranch',
                        'availableBusinesses',
                    ]),
                },
                { provide: toast_service_1.ToastService, useValue: toastServiceSpy },
                {
                    provide: terminology_service_1.TerminologyService,
                    useValue: jasmine.createSpyObj('TerminologyService', ['update']),
                },
                { provide: domain_service_1.DomainService, useValue: domainServiceSpy },
                { provide: subscription_service_1.SubscriptionService, useValue: subscriptionServiceSpy },
                { provide: router_1.ActivatedRoute, useValue: { queryParams: (0, rxjs_1.of)({}) } },
            ],
        }).compileComponents();
        component = testing_1.TestBed.createComponent(config_1.Config).componentInstance;
    });
    it('bloquea dominios personalizados para starter aunque estA(c) en trial', () => {
        statusBusiness.set(makeBusiness({ plan: 'starter' }));
        statusTrialDaysLeft.set(10);
        component.domainInput.set('mi-dominio.com');
        component.addDomain();
        expect(domainServiceSpy.add).not.toHaveBeenCalled();
        expect(toastServiceSpy.error).toHaveBeenCalled();
        expect(toastServiceSpy.error.calls.mostRecent().args[0]).toContain('dominios personalizados');
    });
    it('agrega el dominio cuando el negocio es Pro y normaliza el valor', () => {
        statusBusiness.set(makeBusiness({ plan: 'pro' }));
        statusTrialDaysLeft.set(null);
        const response = {
            message: 'ok',
            custom_domain: 'mi-dominio.com',
            dns_instructions: {
                type: 'CNAME',
                name: 'www',
                value: 'cname.vercel-dns.com',
                note: 'Configura el CNAME',
            },
        };
        domainServiceSpy.add.and.returnValue((0, rxjs_1.of)(response));
        component.domainInput.set('  MI-DOMINIO.COM  ');
        component.addDomain();
        expect(domainServiceSpy.add).toHaveBeenCalledWith('mi-dominio.com');
        expect(component.domainStatus()?.custom_domain).toBe('mi-dominio.com');
        expect(component.dnsInstructions()).toEqual(response.dns_instructions);
        expect(component.domainInput()).toBe('');
        expect(toastServiceSpy.success).toHaveBeenCalled();
        expect(toastServiceSpy.success.calls.mostRecent().args[0]).toContain('Dominio agregado');
    });
    it('no marca un plan como actual durante trial si todavAeda no hay suscripciA3n activa', () => {
        statusBusiness.set(makeBusiness({ plan: 'starter' }));
        statusTrialDaysLeft.set(7);
        component.subscription.set(null);
        expect(component.isCurrentActivePlan('pro')).toBeFalse();
        expect(component.planNombre).toBe('Trial Pro');
    });
    it('muestra el prA3ximo cobro para una suscripciA3n activa', () => {
        component.subscription.set(makeSubscription({
            status: 'active',
            current_period_end: '2026-05-20T00:00:00.000Z',
        }));
        expect(component.currentSubscriptionEyebrow()).toContain('Suscrip');
        expect(component.nextSubscriptionEventLabel()).toContain('cobro');
    });
    it('muestra el fin del perA-odo para una suscripciA3n cancelada', () => {
        component.subscription.set(makeSubscription({
            status: 'canceled',
            current_period_end: '2026-05-20T00:00:00.000Z',
        }));
        expect(component.currentSubscriptionEyebrow()).toContain('Cancelada');
        expect(component.nextSubscriptionEventLabel()).toContain('Activo hasta');
    });
    it('muestra el perA-odo de gracia cuando corresponde', () => {
        component.subscription.set(makeSubscription({
            status: 'grace_period',
            current_period_end: '2026-05-20T00:00:00.000Z',
            grace_period_ends_at: '2026-05-27T00:00:00.000Z',
        }));
        expect(component.currentSubscriptionEyebrow()).toContain('gracia');
        expect(component.nextSubscriptionEventLabel()).toContain('gracia hasta');
    });
    it('expone el nombre del plan pendiente para reintentar pago', () => {
        component.pendingSubscription.set(makeSubscription({ plan: 'starter', status: 'pending' }));
        expect(component.hasPendingSubscription()).toBeTrue();
        expect(component.isPendingPlan('starter')).toBeTrue();
        expect(component.pendingPlanLabel()).toBe('Starter');
    });
});
//# sourceMappingURL=config.spec.js.map