import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthResponse, User } from '../../domain/models/user.model';
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
interface UpdateProfileRequest {
    nombre: string;
    password?: string;
}
export declare class AuthService {
    private readonly http;
    private readonly router;
    private readonly terminologyService;
    private readonly TOKEN_KEY;
    private readonly REFRESH_TOKEN_KEY;
    private readonly apiUrl;
    private readonly _currentUser;
    readonly currentUser: any;
    constructor(http: HttpClient, router: Router, terminologyService: TerminologyService);
    register(data: RegisterRequest): Observable<RegisterResponse>;
    login(email: string, password: string): Observable<AuthResponse>;
    readonly availableBusinesses: any;
    me(): Observable<User>;
    createBranch(nombre: string, slug: string): Observable<void>;
    logout(): void;
    getToken(): string | null;
    isLoggedIn(): boolean;
    private isTokenExpired;
    refreshToken(): Observable<string>;
    updateProfile(data: UpdateProfileRequest): Observable<void>;
    requestPasswordReset(email: string): Observable<void>;
    resetPassword(accessToken: string, password: string): Observable<void>;
}
export {};
//# sourceMappingURL=auth.service.d.ts.map