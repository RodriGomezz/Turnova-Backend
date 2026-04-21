"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const router_1 = require("@angular/router");
const rxjs_1 = require("rxjs");
const dashboard_1 = require("./dashboard");
const booking_service_1 = require("../../../core/services/booking.service");
const business_service_1 = require("../../../core/services/business.service");
const business_status_service_1 = require("../../../core/services/business-status.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
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
function makeBooking(overrides = {}) {
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
    let bookingServiceSpy;
    let businessServiceSpy;
    let toastServiceSpy;
    let component;
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
        bookingServiceSpy.getByDate.and.returnValue((0, rxjs_1.of)([]));
        bookingServiceSpy.getDaySummary.and.returnValue((0, rxjs_1.of)({
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
        }));
        businessServiceSpy.get.and.returnValue((0, rxjs_1.of)(makeBusiness()));
        businessServiceSpy.getStatus.and.returnValue((0, rxjs_1.of)({
            plan: 'starter',
            trialActivo: false,
            maxBarberos: 1,
            totalBarberos: 1,
            excedeLimit: false,
        }));
        await testing_1.TestBed.configureTestingModule({
            imports: [dashboard_1.Dashboard],
            providers: [
                { provide: booking_service_1.BookingService, useValue: bookingServiceSpy },
                { provide: business_service_1.BusinessService, useValue: businessServiceSpy },
                {
                    provide: business_status_service_1.BusinessStatusService,
                    useValue: {
                        isPro: () => false,
                        trialDaysLeft: () => null,
                    },
                },
                { provide: toast_service_1.ToastService, useValue: toastServiceSpy },
                {
                    provide: terminology_service_1.TerminologyService,
                    useValue: {
                        profesional: () => 'Barbero',
                        profesionalPlural: () => 'Barberos',
                        servicio: () => 'Servicio',
                        reserva: () => 'Turno',
                    },
                },
                { provide: router_1.ActivatedRoute, useValue: {} },
            ],
        }).compileComponents();
        component = testing_1.TestBed.createComponent(dashboard_1.Dashboard).componentInstance;
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
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://mi-negocio.localhost:4200');
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
//# sourceMappingURL=dashboard.spec.js.map