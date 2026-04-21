// src/app/core/interceptors/auth.interceptor.ts
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { throwError, BehaviorSubject } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

// ── Estado del refresh — encapsulado en un objeto para evitar
//    que quede "colgado" entre instancias del interceptor. ──────────────────

const refreshState = {
  isRefreshing: false,
  token$: new BehaviorSubject<string | null>(null),

  reset(): void {
    this.isRefreshing = false;
    this.token$.next(null);
  },
};

// ── Interceptor ───────────────────────────────────────────────────────────

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  if (!isApiRequest) return next(req);

  const token = authService.getToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status !== 401) return throwError(() => err);
      return handleUnauthorized(req, next, authService);
    }),
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────

function addToken(
  req: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
) {
  if (refreshState.isRefreshing) {
    // Otro request ya inició el refresh — esperar el nuevo token
    return refreshState.token$.pipe(
      filter((t): t is string => t !== null),
      take(1),
      switchMap((newToken) => next(addToken(req, newToken))),
    );
  }

  refreshState.isRefreshing = true;
  refreshState.token$.next(null);

  return authService.refreshToken().pipe(
    switchMap((newToken) => {
      refreshState.isRefreshing = false;
      refreshState.token$.next(newToken);
      return next(addToken(req, newToken));
    }),
    catchError((refreshErr) => {
      refreshState.reset();
      authService.logout();
      return throwError(() => refreshErr);
    }),
  );
}