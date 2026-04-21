"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@angular/core/testing");
const router_1 = require("@angular/router");
const auth_guard_1 = require("./auth.guard");
const auth_service_1 = require("../services/auth.service");
const rxjs_1 = require("rxjs");
// ── Helpers ───────────────────────────────────────────────────────────────────
const fakeUser = {
    id: '1',
    email: 'u@test.com',
    nombre: 'Test',
    rol: 'owner',
    business_id: 'b1',
    created_at: '2024-01-01',
};
const fakeRoute = {};
const fakeState = { url: '/panel/dashboard' };
// ── Suite ─────────────────────────────────────────────────────────────────────
describe('authGuard', () => {
    let authServiceSpy;
    let router;
    beforeEach(() => {
        authServiceSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'currentUser', 'me', 'logout']);
        testing_1.TestBed.configureTestingModule({
            providers: [
                { provide: auth_service_1.AuthService, useValue: authServiceSpy },
                {
                    provide: router_1.Router,
                    useValue: {
                        createUrlTree: (commands) => ({ commands }),
                        navigate: jasmine.createSpy('navigate'),
                    },
                },
            ],
        });
        router = testing_1.TestBed.inject(router_1.Router);
    });
    // ── No logueado ─────────────────────────────────────────────────────────────
    it('redirige a /login si el usuario no está logueado', () => {
        authServiceSpy.isLoggedIn.and.returnValue(false);
        const result = testing_1.TestBed.runInInjectionContext(() => (0, auth_guard_1.authGuard)(fakeRoute, fakeState));
        expect(result).toEqual(jasmine.objectContaining({ commands: ['/login'] }));
    });
    // ── Logueado con usuario en memoria ─────────────────────────────────────────
    it('permite el acceso si el usuario ya está en memoria', () => {
        authServiceSpy.isLoggedIn.and.returnValue(true);
        // El signal currentUser() retorna el usuario
        authServiceSpy.currentUser.and.returnValue(fakeUser);
        const result = testing_1.TestBed.runInInjectionContext(() => (0, auth_guard_1.authGuard)(fakeRoute, fakeState));
        expect(result).toBeTrue();
        expect(authServiceSpy.me).not.toHaveBeenCalled();
    });
    // ── Recarga de página — token válido sin usuario en memoria ─────────────────
    it('llama a me() y retorna true si la rehidratación es exitosa', (done) => {
        authServiceSpy.isLoggedIn.and.returnValue(true);
        authServiceSpy.currentUser.and.returnValue(null);
        authServiceSpy.me.and.returnValue((0, rxjs_1.of)(fakeUser));
        const result$ = testing_1.TestBed.runInInjectionContext(() => (0, auth_guard_1.authGuard)(fakeRoute, fakeState));
        result$.subscribe((result) => {
            expect(result).toBeTrue();
            expect(authServiceSpy.me).toHaveBeenCalledTimes(1);
            done();
        });
    });
    it('llama a logout y retorna false si me() falla', (done) => {
        authServiceSpy.isLoggedIn.and.returnValue(true);
        authServiceSpy.currentUser.and.returnValue(null);
        authServiceSpy.me.and.returnValue((0, rxjs_1.throwError)(() => new Error('Unauthorized')));
        const result$ = testing_1.TestBed.runInInjectionContext(() => (0, auth_guard_1.authGuard)(fakeRoute, fakeState));
        result$.subscribe((result) => {
            expect(result).toBeFalse();
            expect(authServiceSpy.logout).toHaveBeenCalled();
            done();
        });
    });
});
//# sourceMappingURL=auth.guard.spec.js.map