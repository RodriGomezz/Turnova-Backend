import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { BookingService } from '../../../core/services/booking.service';
import { BusinessService } from '../../../core/services/business.service';
import { BusinessStatusService } from '../../../core/services/business-status.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { Business } from '../../../domain/models/business.model';
import { Booking } from '../../../domain/models/booking.model';

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

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    business_id: 'biz-1',
    barber_id: 'barber-1',
    service_id: 'service-1',
    cliente_nombre: 'Juan',
    cliente_email: 'juan@test.com',
    cliente_telefono: '099000000',
    fecha: '2026-04-20',
    hora_inicio: '09:00',
    hora_fin: '10:00',
    estado: 'pendiente',
    cancellation_token: 'token',
    reminder_sent_at: null,
    created_at: '2026-04-20T08:00:00.000Z',
    services: { nombre: 'Corte', duracion_minutos: 60 },
    ...overrides,
  };
}

describe('Dashboard', () => {
  let bookingServiceSpy: jasmine.SpyObj<BookingService>;
  let businessServiceSpy: jasmine.SpyObj<BusinessService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let component: Dashboard;

  beforeEach(async () => {
    bookingServiceSpy = jasmine.createSpyObj('BookingService', [
      'getByDate',
      'getDaySummary',
      'updateEstado',
    ]);
    businessServiceSpy = jasmine.createSpyObj('BusinessService', [
      'get',
      'getStatus',
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);

    bookingServiceSpy.getByDate.and.returnValue(of([]));
    bookingServiceSpy.getDaySummary.and.returnValue(
      of({
        fecha: '2026-04-20',
        resumen: {
          totalTurnos: 0,
          cancelados: 0,
          pendientes: 0,
          confirmados: 0,
          ingresoDia: 0,
          ocupacionPct: 0,
          primerTurnoLibre: null,
          clientesNuevosHoy: 0,
          esDiaNoLaborable: false,
        },
        barbers: [],
      }),
    );
    businessServiceSpy.get.and.returnValue(of(makeBusiness()));
    businessServiceSpy.getStatus.and.returnValue(
      of({
        plan: 'starter',
        trialActivo: false,
        maxBarberos: 1,
        totalBarberos: 1,
        excedeLimit: false,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: BookingService, useValue: bookingServiceSpy },
        { provide: BusinessService, useValue: businessServiceSpy },
        {
          provide: BusinessStatusService,
          useValue: {
            isPro: () => false,
            trialDaysLeft: () => null,
          },
        },
        { provide: ToastService, useValue: toastServiceSpy },
        {
          provide: TerminologyService,
          useValue: {
            profesional: () => 'Barbero',
            profesionalPlural: () => 'Barberos',
            servicio: () => 'Servicio',
            reserva: () => 'Turno',
          },
        },
        { provide: ActivatedRoute, useValue: {} },
      ],
    }).compileComponents();

    component = TestBed.createComponent(Dashboard).componentInstance;
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('copia el link pAublico en localhost usando el slug del negocio', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jasmine.createSpy('writeText') },
    });

    component['business'].set(makeBusiness({ slug: 'mi-negocio' }));
    component.copyPublicLink();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'http://mi-negocio.localhost:4200',
    );
    expect(toastServiceSpy.success).toHaveBeenCalledWith('Link copiado');
  });

  it('no intenta copiar si todavAeda no hay slug', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jasmine.createSpy('writeText') },
    });

    component['business'].set(makeBusiness({ slug: '' }));
    component.copyPublicLink();

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(toastServiceSpy.success).not.toHaveBeenCalled();
  });

  it('detecta reservas pasadas solo cuando la fecha seleccionada es hoy', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-04-20T15:00:00'));

    component.selectedFecha.set('2026-04-20');
    expect(component.isPast(makeBooking({ hora_fin: '14:30' }))).toBeTrue();
    expect(component.isPast(makeBooking({ hora_fin: '15:30' }))).toBeFalse();

    component.selectedFecha.set('2026-04-21');
    expect(component.isPast(makeBooking({ hora_fin: '14:30' }))).toBeFalse();
  });

  it('devuelve etiquetas de ocupaciA3n segAon el porcentaje', () => {
    expect(component.getOcupacionLabel(90)).toBe('Día lleno');
    expect(component.getOcupacionLabel(70)).toBe('Buen ritmo');
    expect(component.getOcupacionLabel(40)).toBe('Ritmo moderado');
    expect(component.getOcupacionLabel(5)).toBe('Día tranquilo');
  });

  it('devuelve colores de ocupaciA3n segAon el porcentaje', () => {
    expect(component.getOcupacionColor(90)).toBe('#22C55E');
    expect(component.getOcupacionColor(70)).toBe('#C9A84C');
    expect(component.getOcupacionColor(40)).toBe('#3B82F6');
    expect(component.getOcupacionColor(5)).toBe('#9CA3AF');
  });
});
