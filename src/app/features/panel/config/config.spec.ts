import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Config } from './config';
import { BusinessService } from '../../../core/services/business.service';
import { BusinessStatusService } from '../../../core/services/business-status.service';
import { StorageService } from '../../../core/services/storage.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import {
  AddDomainResponse,
  DomainService,
  DomainStatus,
} from '../../../core/services/domain.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { Business } from '../../../domain/models/business.model';
import { Subscription } from '../../../domain/models/subscription.model';

function makeBusiness(overrides: Partial<Business> = {}): Business {
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

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
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
  let component: Config;
  let domainServiceSpy: jasmine.SpyObj<DomainService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let subscriptionServiceSpy: jasmine.SpyObj<SubscriptionService>;
  let statusBusiness: ReturnType<typeof signal<Business | null>>;
  let statusTrialDaysLeft: ReturnType<typeof signal<number | null>>;

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

    statusBusiness = signal<Business | null>(makeBusiness());
    statusTrialDaysLeft = signal<number | null>(null);

    domainServiceSpy.get.and.returnValue(
      of({
        custom_domain: null,
        domain_verified: false,
        domain_verified_at: null,
        domain_added_at: null,
      }),
    );
    subscriptionServiceSpy.getState.and.returnValue(
      of({
        subscription: null,
        activeSubscription: null,
        pendingSubscription: null,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Config],
      providers: [
        {
          provide: BusinessService,
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
          provide: BusinessStatusService,
          useValue: {
            business: statusBusiness,
            trialDaysLeft: statusTrialDaysLeft,
            refresh: () => of(void 0),
          },
        },
        {
          provide: StorageService,
          useValue: jasmine.createSpyObj('StorageService', ['uploadBusinessAsset']),
        },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj('AuthService', [
            'me',
            'updateProfile',
            'createBranch',
            'availableBusinesses',
          ]),
        },
        { provide: ToastService, useValue: toastServiceSpy },
        {
          provide: TerminologyService,
          useValue: jasmine.createSpyObj('TerminologyService', ['update']),
        },
        { provide: DomainService, useValue: domainServiceSpy },
        { provide: SubscriptionService, useValue: subscriptionServiceSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    }).compileComponents();

    component = TestBed.createComponent(Config).componentInstance;
  });

  it('bloquea dominios personalizados para starter aunque estA(c) en trial', () => {
    statusBusiness.set(makeBusiness({ plan: 'starter' }));
    statusTrialDaysLeft.set(10);
    component.domainInput.set('mi-dominio.com');

    component.addDomain();

    expect(domainServiceSpy.add).not.toHaveBeenCalled();
    expect(toastServiceSpy.error).toHaveBeenCalled();
    expect(toastServiceSpy.error.calls.mostRecent().args[0]).toContain(
      'dominios personalizados',
    );
  });

  it('agrega el dominio cuando el negocio es Pro y normaliza el valor', () => {
    statusBusiness.set(makeBusiness({ plan: 'pro' }));
    statusTrialDaysLeft.set(null);

    const response: AddDomainResponse = {
      message: 'ok',
      custom_domain: 'mi-dominio.com',
      dns_instructions: {
        type: 'CNAME',
        name: 'www',
        value: 'cname.vercel-dns.com',
        note: 'Configura el CNAME',
      },
    };
    domainServiceSpy.add.and.returnValue(of(response));
    component.domainInput.set('  MI-DOMINIO.COM  ');

    component.addDomain();

    expect(domainServiceSpy.add).toHaveBeenCalledWith('mi-dominio.com');
    expect(component.domainStatus()?.custom_domain).toBe('mi-dominio.com');
    expect(component.dnsInstructions()).toEqual(response.dns_instructions);
    expect(component.domainInput()).toBe('');
    expect(toastServiceSpy.success).toHaveBeenCalled();
    expect(toastServiceSpy.success.calls.mostRecent().args[0]).toContain(
      'Dominio agregado',
    );
  });

  it('no marca un plan como actual durante trial si todavAeda no hay suscripciA3n activa', () => {
    statusBusiness.set(makeBusiness({ plan: 'starter' }));
    statusTrialDaysLeft.set(7);
    component.subscription.set(null);

    expect(component.isCurrentActivePlan('pro')).toBeFalse();
    expect(component.planNombre).toBe('Trial Pro');
  });

  it('muestra el prA3ximo cobro para una suscripciA3n activa', () => {
    component.subscription.set(
      makeSubscription({
        status: 'active',
        current_period_end: '2026-05-20T00:00:00.000Z',
      }),
    );

    expect(component.currentSubscriptionEyebrow()).toContain('Suscrip');
    expect(component.nextSubscriptionEventLabel()).toContain('cobro');
  });

  it('muestra el fin del perA-odo para una suscripciA3n cancelada', () => {
    component.subscription.set(
      makeSubscription({
        status: 'canceled',
        current_period_end: '2026-05-20T00:00:00.000Z',
      }),
    );

    expect(component.currentSubscriptionEyebrow()).toContain('Cancelada');
    expect(component.nextSubscriptionEventLabel()).toContain('Activo hasta');
  });

  it('muestra el perA-odo de gracia cuando corresponde', () => {
    component.subscription.set(
      makeSubscription({
        status: 'grace_period',
        current_period_end: '2026-05-20T00:00:00.000Z',
        grace_period_ends_at: '2026-05-27T00:00:00.000Z',
      }),
    );

    expect(component.currentSubscriptionEyebrow()).toContain('gracia');
    expect(component.nextSubscriptionEventLabel()).toContain(
      'gracia hasta',
    );
  });

  it('expone el nombre del plan pendiente para reintentar pago', () => {
    component.pendingSubscription.set(
      makeSubscription({ plan: 'starter', status: 'pending' }),
    );

    expect(component.hasPendingSubscription()).toBeTrue();
    expect(component.isPendingPlan('starter')).toBeTrue();
    expect(component.pendingPlanLabel()).toBe('Starter');
  });
});
