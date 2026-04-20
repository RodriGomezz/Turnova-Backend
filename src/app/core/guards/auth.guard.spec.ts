import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { of, throwError } from 'rxjs';
import { User } from '../../domain/models/user.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeUser: User = {
  id: '1',
  email: 'u@test.com',
  nombre: 'Test',
  rol: 'owner',
  business_id: 'b1',
  created_at: '2024-01-01',
};

const fakeRoute = {} as ActivatedRouteSnapshot;
const fakeState = { url: '/panel/dashboard' } as RouterStateSnapshot;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'currentUser', 'me', 'logout']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: any[]) => ({ commands } as any),
            navigate: jasmine.createSpy('navigate'),
          },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  // ── No logueado ─────────────────────────────────────────────────────────────

  it('redirige a /login si el usuario no está logueado', () => {
    authServiceSpy.isLoggedIn.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toEqual(jasmine.objectContaining({ commands: ['/login'] }));
  });

  // ── Logueado con usuario en memoria ─────────────────────────────────────────

  it('permite el acceso si el usuario ya está en memoria', () => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    // El signal currentUser() retorna el usuario
    (authServiceSpy.currentUser as any).and.returnValue(fakeUser);

    const result = TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

    expect(result).toBeTrue();
    expect(authServiceSpy.me).not.toHaveBeenCalled();
  });

  // ── Recarga de página — token válido sin usuario en memoria ─────────────────

  it('llama a me() y retorna true si la rehidratación es exitosa', (done) => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    (authServiceSpy.currentUser as any).and.returnValue(null);
    authServiceSpy.me.and.returnValue(of(fakeUser));

    const result$ = TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState)) as any;

    result$.subscribe((result: any) => {
      expect(result).toBeTrue();
      expect(authServiceSpy.me).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('llama a logout y retorna false si me() falla', (done) => {
    authServiceSpy.isLoggedIn.and.returnValue(true);
    (authServiceSpy.currentUser as any).and.returnValue(null);
    authServiceSpy.me.and.returnValue(throwError(() => new Error('Unauthorized')));

    const result$ = TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState)) as any;

    result$.subscribe((result: any) => {
      expect(result).toBeFalse();
      expect(authServiceSpy.logout).toHaveBeenCalled();
      done();
    });
  });

});
