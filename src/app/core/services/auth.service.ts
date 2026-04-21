import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, map } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, BusinessSummary, User } from '../../domain/models/user.model';
import { TerminologyService } from './terminology.service';

interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  nombre_negocio: string;
  slug: string;
  tipo_negocio?: string;
  termino_profesional?: string;
  termino_profesional_plural?: string;
  termino_servicio?: string;
  termino_reserva?: string;
}

interface RegisterResponse {
  message: string;
}

interface RefreshResponse {
  token: string;
  refresh_token?: string;
  expires_at: number;
}

interface UpdateProfileRequest {
  nombre: string;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'turnio_token';
  private readonly REFRESH_TOKEN_KEY = 'turnio_refresh_token';
  private readonly apiUrl = environment.apiUrl;

  private readonly _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly terminologyService: TerminologyService,
  ) {}

  // ── Auth ───────────────────────────────────────────────────────────────────

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.apiUrl}/auth/register`,
      data,
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          if (res.refresh_token) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refresh_token);
          }
        }),
      );
  }

  readonly availableBusinesses = signal<BusinessSummary[]>([]);

  me(): Observable<User> {
    return this.http
      .get<{
        user: User;
        businesses: BusinessSummary[];
      }>(`${this.apiUrl}/auth/me`)
      .pipe(
        tap((res) => {
          this._currentUser.set(res.user);
          this.availableBusinesses.set(res.businesses ?? []);
        }),
        map((res) => res.user),
      );
  }

  createBranch(nombre: string, slug: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/branch`, { nombre, slug });
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this._currentUser.set(null);
    this.terminologyService.clear();
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // ── Session ────────────────────────────────────────────────────────────────

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired(token);
  }

  // Validación client-side — no reemplaza verificación de firma en el backend.
  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      if (typeof payload.exp !== 'number') return true;

      const bufferMs = 30_000;
      return payload.exp * 1000 < Date.now() + bufferMs;
    } catch {
      return true;
    }
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  refreshToken(): Observable<string> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      this.logout();
      return throwError(
        () => new Error('Session expired. Please log in again.'),
      );
    }

    return this.http
      .post<RefreshResponse>(`${this.apiUrl}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          if (res.refresh_token) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refresh_token);
          }
        }),
        map((res) => res.token),
      );
  }

  // dentro de la clase AuthService:
  updateProfile(data: UpdateProfileRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/auth/profile`, data);
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/request-reset`, { email });
  }

  resetPassword(accessToken: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/reset-password`, {
      access_token: accessToken,
      password,
    });
  }
}


