"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const testing_2 = require("@angular/common/http/testing");
const terminology_service_1 = require("./terminology.service");
const business_service_1 = require("./business.service");
const rxjs_1 = require("rxjs");
// ── Factory ───────────────────────────────────────────────────────────────────
function makeBusiness(overrides = {}) {
    return {
        id: 'b1', slug: 'test', nombre: 'Test', logo_url: null,
        color_fondo: '#fff', color_acento: '#000', color_superficie: '#eee',
        email: null, whatsapp: null, direccion: null,
        timezone: 'America/Montevideo', buffer_minutos: 0, auto_confirmar: true,
        activo: true, plan: 'starter', trial_ends_at: '',
        created_at: '2024-01-01T00:00:00.000Z',
        frase_bienvenida: null, hero_imagen_url: null,
        instagram: null, facebook: null,
        tipografia: 'clasica', estilo_cards: 'destacado',
        tipo_negocio: 'salon',
        termino_profesional: 'Estilista',
        termino_profesional_plural: 'Estilistas',
        termino_servicio: 'Corte',
        termino_reserva: 'Cita',
        onboarding_completed: true,
        ...overrides,
    };
}
// ── Suite ─────────────────────────────────────────────────────────────────────
describe('TerminologyService', () => {
    let service;
    let businessSpy;
    const CACHE_KEY = 'turnio_terms';
    beforeEach(() => {
        localStorage.clear();
        businessSpy = jasmine.createSpyObj('BusinessService', ['get']);
        testing_1.TestBed.configureTestingModule({
            imports: [testing_2.HttpClientTestingModule],
            providers: [
                terminology_service_1.TerminologyService,
                { provide: business_service_1.BusinessService, useValue: businessSpy },
            ],
        });
        service = testing_1.TestBed.inject(terminology_service_1.TerminologyService);
    });
    afterEach(() => localStorage.clear());
    // ── Defaults ──────────────────────────────────────────────────────────────
    describe('estado inicial', () => {
        it('arranca con los términos por defecto si no hay caché', () => {
            expect(service.profesional()).toBe('Barbero');
            expect(service.profesionalPlural()).toBe('Barberos');
            expect(service.servicio()).toBe('Servicio');
            expect(service.reserva()).toBe('Turno');
        });
        it('carga los términos desde el caché si existen', () => {
            const cached = { profesional: 'Médico', profesionalPlural: 'Médicos', servicio: 'Consulta', reserva: 'Turno médico' };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
            // Reinstanciar para que lea el caché
            testing_1.TestBed.resetTestingModule();
            testing_1.TestBed.configureTestingModule({
                imports: [testing_2.HttpClientTestingModule],
                providers: [terminology_service_1.TerminologyService, { provide: business_service_1.BusinessService, useValue: businessSpy }],
            });
            const svc2 = testing_1.TestBed.inject(terminology_service_1.TerminologyService);
            expect(svc2.profesional()).toBe('Médico');
            expect(svc2.reserva()).toBe('Turno médico');
        });
        it('usa defaults si el caché es JSON inválido', () => {
            localStorage.setItem(CACHE_KEY, 'not-json-at-all');
            testing_1.TestBed.resetTestingModule();
            testing_1.TestBed.configureTestingModule({
                imports: [testing_2.HttpClientTestingModule],
                providers: [terminology_service_1.TerminologyService, { provide: business_service_1.BusinessService, useValue: businessSpy }],
            });
            const svc2 = testing_1.TestBed.inject(terminology_service_1.TerminologyService);
            expect(svc2.profesional()).toBe('Barbero');
        });
    });
    // ── load() ────────────────────────────────────────────────────────────────
    describe('load()', () => {
        it('llama a businessService.get() y actualiza los términos', () => {
            businessSpy.get.and.returnValue((0, rxjs_1.of)(makeBusiness()));
            service.load().subscribe();
            expect(service.profesional()).toBe('Estilista');
            expect(service.profesionalPlural()).toBe('Estilistas');
            expect(service.servicio()).toBe('Corte');
            expect(service.reserva()).toBe('Cita');
        });
        it('persiste los términos en localStorage después de cargar', () => {
            businessSpy.get.and.returnValue((0, rxjs_1.of)(makeBusiness()));
            service.load().subscribe();
            const raw = localStorage.getItem(CACHE_KEY);
            expect(raw).not.toBeNull();
            const cached = JSON.parse(raw);
            expect(cached.profesional).toBe('Estilista');
        });
        it('emite void en el observable (no el business)', () => {
            businessSpy.get.and.returnValue((0, rxjs_1.of)(makeBusiness()));
            let emitted = 'not-set';
            service.load().subscribe(v => emitted = v);
            expect(emitted).toBeUndefined();
        });
        it('actualiza el signal terms con los 4 campos del negocio', () => {
            const biz = makeBusiness({
                termino_profesional: 'Tatuador',
                termino_profesional_plural: 'Tatuadores',
                termino_servicio: 'Sesión',
                termino_reserva: 'Reserva',
            });
            businessSpy.get.and.returnValue((0, rxjs_1.of)(biz));
            service.load().subscribe();
            const terms = service.terms();
            expect(terms.profesional).toBe('Tatuador');
            expect(terms.profesionalPlural).toBe('Tatuadores');
            expect(terms.servicio).toBe('Sesión');
            expect(terms.reserva).toBe('Reserva');
        });
    });
    // ── update() ──────────────────────────────────────────────────────────────
    describe('update()', () => {
        it('actualiza el signal inmediatamente', () => {
            service.update({ profesional: 'Nutricionista', profesionalPlural: 'Nutricionistas', servicio: 'Consulta', reserva: 'Turno' });
            expect(service.profesional()).toBe('Nutricionista');
        });
        it('persiste los cambios en localStorage', () => {
            service.update({ profesional: 'Coach', profesionalPlural: 'Coaches', servicio: 'Sesión', reserva: 'Cita' });
            const raw = localStorage.getItem(CACHE_KEY);
            const cached = JSON.parse(raw);
            expect(cached.profesional).toBe('Coach');
        });
        it('los computed signals reflejan los valores actualizados', () => {
            service.update({ profesional: 'Dentista', profesionalPlural: 'Dentistas', servicio: 'Limpieza', reserva: 'Consulta' });
            expect(service.profesionalPlural()).toBe('Dentistas');
            expect(service.servicio()).toBe('Limpieza');
            expect(service.reserva()).toBe('Consulta');
        });
    });
    // ── clear() ───────────────────────────────────────────────────────────────
    describe('clear()', () => {
        it('elimina la clave de localStorage', () => {
            localStorage.setItem(CACHE_KEY, '{"profesional":"Test"}');
            service.clear();
            expect(localStorage.getItem(CACHE_KEY)).toBeNull();
        });
        it('no lanza error si localStorage está vacío', () => {
            expect(() => service.clear()).not.toThrow();
        });
        it('no resetea el signal en memoria — solo limpia el caché persistido', () => {
            service.update({ profesional: 'En memoria', profesionalPlural: 'Pl', servicio: 'S', reserva: 'R' });
            service.clear();
            // El signal sigue con el valor en memoria
            expect(service.profesional()).toBe('En memoria');
            // Pero el caché fue borrado
            expect(localStorage.getItem(CACHE_KEY)).toBeNull();
        });
    });
});
//# sourceMappingURL=terminology.service.spec.js.map