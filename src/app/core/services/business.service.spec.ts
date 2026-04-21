import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BusinessService } from './business.service';
import { environment } from '../../../environments/environment';
import { Business, BusinessBranch } from '../../domain/models/business.model';

// ── Factory ───────────────────────────────────────────────────────────────────

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 'biz-1',
    slug: 'mi-barberia',
    nombre: 'Mi Barbería',
    logo_url: null,
    color_fondo: '#ffffff',
    color_acento: '#000000',
    color_superficie: '#f0f0f0',
    email: 'info@mibarberia.com',
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
    onboarding_completed: false,
    ...overrides,
  };
}

function makeBranch(overrides: Partial<BusinessBranch> = {}): BusinessBranch {
  return {
    id: 'biz-2',
    nombre: 'Sucursal Norte',
    slug: 'sucursal-norte',
    logo_url: null,
    activo: true,
    plan: 'starter',
    esPrincipal: false,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('BusinessService', () => {
  let service: BusinessService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BusinessService],
    });
    service = TestBed.inject(BusinessService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ── get() ─────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('hace GET a /business y devuelve el negocio', () => {
      const biz = makeBusiness();
      let result: Business | undefined;
      service.get().subscribe(b => result = b);

      const req = http.expectOne(`${api}/business`);
      expect(req.request.method).toBe('GET');
      req.flush({ business: biz });
      expect(result).toEqual(biz);
    });

    it('desenvuelve el wrapper { business }', () => {
      let result: Business | undefined;
      service.get().subscribe(b => result = b);
      http.expectOne(`${api}/business`).flush({ business: makeBusiness({ nombre: 'Peluquería Test' }) });
      expect(result?.nombre).toBe('Peluquería Test');
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('hace PUT a /business con los datos enviados', () => {
      const payload = { nombre: 'Nuevo Nombre', email: 'nuevo@test.com' };
      service.update(payload).subscribe();

      const req = http.expectOne(`${api}/business`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);
      req.flush({ business: makeBusiness({ nombre: 'Nuevo Nombre' }) });
    });

    it('devuelve el negocio actualizado', () => {
      let result: Business | undefined;
      service.update({ nombre: 'Actualizado' }).subscribe(b => result = b);
      http.expectOne(`${api}/business`).flush({ business: makeBusiness({ nombre: 'Actualizado' }) });
      expect(result?.nombre).toBe('Actualizado');
    });

    it('puede actualizar colores y tipografía', () => {
      const payload = { color_fondo: '#1a1a1a', color_acento: '#ff6600', tipografia: 'moderna' as const };
      service.update(payload).subscribe();
      const req = http.expectOne(`${api}/business`);
      expect(req.request.body).toEqual(payload);
      req.flush({ business: makeBusiness() });
    });
  });

  // ── getStatus() ───────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('hace GET a /business/status', () => {
      const status = { plan: 'starter', trialActivo: true, maxBarberos: 1, totalBarberos: 1, excedeLimit: false };
      let result: any;
      service.getStatus().subscribe(s => result = s);

      const req = http.expectOne(`${api}/business/status`);
      expect(req.request.method).toBe('GET');
      req.flush(status);
      expect(result).toEqual(status);
    });

    it('reporta excedeLimit correctamente', () => {
      let result: any;
      service.getStatus().subscribe(s => result = s);
      http.expectOne(`${api}/business/status`).flush({
        plan: 'starter', trialActivo: false, maxBarberos: 1, totalBarberos: 3, excedeLimit: true,
      });
      expect(result.excedeLimit).toBeTrue();
    });
  });

  // ── completeOnboarding() ──────────────────────────────────────────────────

  describe('completeOnboarding()', () => {
    it('hace PATCH a /business/onboarding con body vacío', () => {
      service.completeOnboarding().subscribe();
      const req = http.expectOne(`${api}/business/onboarding`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush(null);
    });
  });

  // ── switchBusiness() ──────────────────────────────────────────────────────

  describe('switchBusiness()', () => {
    it('hace PATCH a /business/switch con el business_id', () => {
      service.switchBusiness('biz-99').subscribe();
      const req = http.expectOne(`${api}/business/switch`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ business_id: 'biz-99' });
      req.flush(null);
    });
  });

  // ── listUserBusinesses() ──────────────────────────────────────────────────

  describe('listUserBusinesses()', () => {
    it('hace GET a /business/all con Cache-Control: no-cache', () => {
      service.listUserBusinesses().subscribe();
      const req = http.expectOne(`${api}/business/all`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Cache-Control')).toBe('no-cache');
      req.flush({ businesses: [] });
    });

    it('devuelve el array de sucursales desenvuelto', () => {
      const branches = [makeBranch(), makeBranch({ id: 'biz-3', nombre: 'Sucursal Sur' })];
      let result: BusinessBranch[] = [];
      service.listUserBusinesses().subscribe(b => result = b);
      http.expectOne(`${api}/business/all`).flush({ businesses: branches });
      expect(result.length).toBe(2);
      expect(result[1].nombre).toBe('Sucursal Sur');
    });
  });

  // ── deactivateBranch() ────────────────────────────────────────────────────

  describe('deactivateBranch()', () => {
    it('hace PATCH a /business/:id/deactivate', () => {
      service.deactivateBranch('biz-42').subscribe();
      const req = http.expectOne(`${api}/business/biz-42/deactivate`);
      expect(req.request.method).toBe('PATCH');
      req.flush(null);
    });
  });

  // ── reactivateBranch() ────────────────────────────────────────────────────

  describe('reactivateBranch()', () => {
    it('hace PATCH a /business/:id/reactivate', () => {
      service.reactivateBranch('biz-42').subscribe();
      const req = http.expectOne(`${api}/business/biz-42/reactivate`);
      expect(req.request.method).toBe('PATCH');
      req.flush(null);
    });
  });

  // ── deleteBranch() ────────────────────────────────────────────────────────

  describe('deleteBranch()', () => {
    it('hace DELETE a /business/:id', () => {
      service.deleteBranch('biz-42').subscribe();
      const req = http.expectOne(`${api}/business/biz-42`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

});
