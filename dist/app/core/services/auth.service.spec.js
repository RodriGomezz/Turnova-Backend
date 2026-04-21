"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const testing_2 = require("@angular/common/http/testing");
const router_1 = require("@angular/router");
const auth_service_1 = require("./auth.service");
const terminology_service_1 = require("./terminology.service");
const environment_1 = require("../../../environments/environment");
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Genera un JWT falso con el payload dado (no firma real). */
function makeJwt(payload) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const sig = 'fakesignature';
    return `${header}.${body}.${sig}`;
}
function makeValidToken() {
    return makeJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
}
function makeExpiredToken() {
    return makeJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 100 });
}
// ── Stubs ──────────────────────────────────────────────────────────────────────
const routerStub = { navigate: jasmine.createSpy('navigate') };
const terminologyStub = { clear: jasmine.createSpy('clear') };
// ── Suite ─────────────────────────────────────────────────────────────────────
describe('AuthService', () => {
    let service;
    let http;
    beforeEach(() => {
        localStorage.clear();
        routerStub.navigate.calls.reset();
        terminologyStub.clear.calls.reset();
        testing_1.TestBed.configureTestingModule({
            imports: [testing_2.HttpClientTestingModule],
            providers: [
                auth_service_1.AuthService,
                { provide: router_1.Router, useValue: routerStub },
                { provide: terminology_service_1.TerminologyService, useValue: terminologyStub },
            ],
        });
        service = testing_1.TestBed.inject(auth_service_1.AuthService);
        http = testing_1.TestBed.inject(testing_2.HttpTestingController);
    });
    afterEach(() => {
        http.verify();
        localStorage.clear();
    });
    // ── Estado inicial ──────────────────────────────────────────────────────────
    it('currentUser arranca en null', () => {
        expect(service.currentUser()).toBeNull();
    });
    it('isLoggedIn() es false sin token', () => {
        expect(service.isLoggedIn()).toBeFalse();
    });
    // ── isLoggedIn ──────────────────────────────────────────────────────────────
    describe('isLoggedIn()', () => {
        it('devuelve false si no hay token en localStorage', () => {
            expect(service.isLoggedIn()).toBeFalse();
        });
        it('devuelve true con un token válido no expirado', () => {
            localStorage.setItem('turnio_token', makeValidToken());
            expect(service.isLoggedIn()).toBeTrue();
        });
        it('devuelve false con token expirado', () => {
            localStorage.setItem('turnio_token', makeExpiredToken());
            expect(service.isLoggedIn()).toBeFalse();
        });
        it('devuelve false con token malformado (no 3 partes)', () => {
            localStorage.setItem('turnio_token', 'token-invalido');
            expect(service.isLoggedIn()).toBeFalse();
        });
        it('devuelve false con token sin campo exp', () => {
            const token = makeJwt({ sub: 'user-1' }); // sin exp
            localStorage.setItem('turnio_token', token);
            expect(service.isLoggedIn()).toBeFalse();
        });
        it('el buffer de 30s hace que un token que vence en 15s se considere expirado', () => {
            const token = makeJwt({ sub: 'u', exp: Math.floor(Date.now() / 1000) + 15 });
            localStorage.setItem('turnio_token', token);
            expect(service.isLoggedIn()).toBeFalse();
        });
    });
    // ── getToken ────────────────────────────────────────────────────────────────
    describe('getToken()', () => {
        it('devuelve null si no hay token', () => {
            expect(service.getToken()).toBeNull();
        });
        it('devuelve el token guardado', () => {
            const token = makeValidToken();
            localStorage.setItem('turnio_token', token);
            expect(service.getToken()).toBe(token);
        });
    });
    // ── login ───────────────────────────────────────────────────────────────────
    describe('login()', () => {
        it('guarda el token en localStorage tras login exitoso', () => {
            const token = makeValidToken();
            service.login('user@test.com', 'password').subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/login`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({ email: 'user@test.com', password: 'password' });
            req.flush({ token, user: { id: '1', email: 'user@test.com' } });
            expect(localStorage.getItem('turnio_token')).toBe(token);
        });
        it('guarda el refresh_token si viene en la respuesta', () => {
            service.login('u@t.com', 'p').subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/login`);
            req.flush({
                token: makeValidToken(),
                refresh_token: 'my-refresh-token',
                user: { id: '1', email: 'u@t.com' },
            });
            expect(localStorage.getItem('turnio_refresh_token')).toBe('my-refresh-token');
        });
        it('no guarda refresh_token si no viene en la respuesta', () => {
            service.login('u@t.com', 'p').subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/login`);
            req.flush({ token: makeValidToken(), user: { id: '1', email: 'u@t.com' } });
            expect(localStorage.getItem('turnio_refresh_token')).toBeNull();
        });
    });
    // ── logout ──────────────────────────────────────────────────────────────────
    describe('logout()', () => {
        it('remueve el token de localStorage', () => {
            localStorage.setItem('turnio_token', makeValidToken());
            service.logout();
            expect(localStorage.getItem('turnio_token')).toBeNull();
        });
        it('remueve el refresh_token de localStorage', () => {
            localStorage.setItem('turnio_refresh_token', 'refresh-abc');
            service.logout();
            expect(localStorage.getItem('turnio_refresh_token')).toBeNull();
        });
        it('limpia el currentUser signal', () => {
            service.logout();
            expect(service.currentUser()).toBeNull();
        });
        it('navega a /login', () => {
            service.logout();
            expect(routerStub.navigate).toHaveBeenCalledWith(['/login']);
        });
        it('llama a terminologyService.clear()', () => {
            service.logout();
            expect(terminologyStub.clear).toHaveBeenCalled();
        });
    });
    // ── me ──────────────────────────────────────────────────────────────────────
    describe('me()', () => {
        it('setea currentUser con el user recibido', () => {
            const user = { id: '1', email: 'u@t.com', nombre: 'Test', rol: 'owner', business_id: 'b1', created_at: '2024-01-01' };
            service.me().subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/me`);
            req.flush({ user, businesses: [] });
            expect(service.currentUser()).toEqual(user);
        });
        it('setea availableBusinesses con el array recibido', () => {
            const user = { id: '1', email: 'u@t.com', nombre: 'Test', rol: 'owner', business_id: 'b1', created_at: '2024-01-01' };
            const businesses = [{ id: 'b1', nombre: 'Mi Barbería', slug: 'mi-barberia', logo_url: null }];
            service.me().subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/me`);
            req.flush({ user, businesses });
            expect(service.availableBusinesses()).toEqual(businesses);
        });
        it('emite el user en el observable', () => {
            const user = { id: '1', email: 'u@t.com', nombre: 'Test', rol: 'owner', business_id: 'b1', created_at: '2024-01-01' };
            let emitted;
            service.me().subscribe(u => emitted = u);
            http.expectOne(`${environment_1.environment.apiUrl}/auth/me`).flush({ user, businesses: [] });
            expect(emitted).toEqual(user);
        });
    });
    // ── refreshToken ────────────────────────────────────────────────────────────
    describe('refreshToken()', () => {
        it('llama al endpoint correcto con el refresh token', () => {
            localStorage.setItem('turnio_refresh_token', 'old-refresh');
            service.refreshToken().subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/refresh`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({ refresh_token: 'old-refresh' });
            req.flush({ token: makeValidToken(), expires_at: Date.now() + 3600000 });
        });
        it('actualiza el token en localStorage', () => {
            const newToken = makeValidToken();
            localStorage.setItem('turnio_refresh_token', 'old-refresh');
            service.refreshToken().subscribe();
            http.expectOne(`${environment_1.environment.apiUrl}/auth/refresh`).flush({ token: newToken, expires_at: Date.now() });
            expect(localStorage.getItem('turnio_token')).toBe(newToken);
        });
        it('llama a logout si no hay refresh token', () => {
            let error;
            service.refreshToken().subscribe({ error: e => error = e });
            expect(error).toBeDefined();
            expect(routerStub.navigate).toHaveBeenCalledWith(['/login']);
        });
    });
    // ── register ────────────────────────────────────────────────────────────────
    describe('register()', () => {
        it('envía POST al endpoint correcto', () => {
            const payload = {
                nombre: 'Juan',
                email: 'juan@test.com',
                password: '123456',
                nombre_negocio: 'Mi Barbería',
                slug: 'mi-barberia',
            };
            service.register(payload).subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/register`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual(payload);
            req.flush({ message: 'Registered' });
        });
    });
    // ── requestPasswordReset ────────────────────────────────────────────────────
    describe('requestPasswordReset()', () => {
        it('envía POST con el email', () => {
            service.requestPasswordReset('user@test.com').subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/request-reset`);
            expect(req.request.body).toEqual({ email: 'user@test.com' });
            req.flush(null);
        });
    });
    // ── resetPassword ───────────────────────────────────────────────────────────
    describe('resetPassword()', () => {
        it('envía POST con el access_token y la nueva password', () => {
            service.resetPassword('access-token-123', 'nuevaPassword').subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/reset-password`);
            expect(req.request.body).toEqual({ access_token: 'access-token-123', password: 'nuevaPassword' });
            req.flush(null);
        });
    });
    // ── updateProfile ───────────────────────────────────────────────────────────
    describe('updateProfile()', () => {
        it('envía PUT al endpoint correcto', () => {
            service.updateProfile({ nombre: 'Nuevo Nombre' }).subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/profile`);
            expect(req.request.method).toBe('PUT');
            expect(req.request.body).toEqual({ nombre: 'Nuevo Nombre' });
            req.flush(null);
        });
        it('incluye password opcional si se provee', () => {
            service.updateProfile({ nombre: 'Test', password: 'newPass' }).subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/profile`);
            expect(req.request.body).toEqual({ nombre: 'Test', password: 'newPass' });
            req.flush(null);
        });
    });
    // ── createBranch ────────────────────────────────────────────────────────────
    describe('createBranch()', () => {
        it('envía POST con nombre y slug', () => {
            service.createBranch('Sucursal Norte', 'sucursal-norte').subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/branch`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({ nombre: 'Sucursal Norte', slug: 'sucursal-norte' });
            req.flush(null);
        });
    });
    // ── JWT con payload JSON inválido — rama catch ──────────────────────────────
    describe('isLoggedIn() — JWT con payload corrupto', () => {
        it('devuelve false si el payload no es JSON válido', () => {
            const badToken = 'header.' + btoa('not-json') + '.sig';
            localStorage.setItem('turnio_token', badToken);
            expect(service.isLoggedIn()).toBeFalse();
        });
    });
    // ── refreshToken — guarda nuevo refresh_token ───────────────────────────────
    describe('refreshToken() — actualiza refresh_token si viene en respuesta', () => {
        it('guarda el nuevo refresh_token', () => {
            localStorage.setItem('turnio_refresh_token', 'old-refresh');
            service.refreshToken().subscribe();
            http.expectOne(`${environment_1.environment.apiUrl}/auth/refresh`).flush({
                token: makeValidToken(),
                refresh_token: 'new-refresh-token',
                expires_at: Date.now(),
            });
            expect(localStorage.getItem('turnio_refresh_token')).toBe('new-refresh-token');
        });
    });
    // ── me() — businesses undefined → fallback a [] ────────────────────────────
    describe('me() — fallback cuando businesses es undefined', () => {
        it('setea availableBusinesses a [] si la respuesta no incluye businesses', () => {
            const user = { id: '1', email: 'u@t.com', nombre: 'Test', rol: 'owner', business_id: 'b1', created_at: '2024-01-01' };
            service.me().subscribe();
            const req = http.expectOne(`${environment_1.environment.apiUrl}/auth/me`);
            // Respuesta sin campo businesses (undefined → ?? [])
            req.flush({ user });
            expect(service.availableBusinesses()).toEqual([]);
        });
    });
});
//# sourceMappingURL=auth.service.spec.js.map