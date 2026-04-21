import { TipoNegocio } from '../../../core/models/tipo-negocio';
export declare class Register {
    private readonly authService;
    private readonly router;
    nombre: string;
    nombreNegocio: string;
    slug: string;
    email: string;
    password: string;
    tipoNegocioValue: string;
    readonly tiposNegocio: TipoNegocio[];
    readonly loading: any;
    readonly error: any;
    readonly success: any;
    readonly showPassword: any;
    readonly isExiting: any;
    generateSlug(): void;
    sanitizeSlug(): void;
    get tipoSeleccionado(): TipoNegocio | undefined;
    togglePassword(): void;
    goToLogin(): void;
    onRegister(): void;
}
//# sourceMappingURL=register.d.ts.map