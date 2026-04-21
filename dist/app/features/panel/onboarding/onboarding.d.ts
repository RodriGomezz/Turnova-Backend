import { ServiceDefault } from '../../../domain/models/service.model';
interface DiaHorario {
    dia: number;
    label: string;
    activo: boolean;
    hora_inicio: string;
    hora_fin: string;
}
export declare class Onboarding {
    private readonly barberService;
    private readonly serviceService;
    private readonly scheduleService;
    private readonly businessService;
    private readonly toastService;
    readonly terms: any;
    readonly completed: any;
    readonly skipped: any;
    readonly step: any;
    readonly saving: any;
    private tipoNegocio;
    readonly profesionalNombre: any;
    readonly profesionalDescripcion: any;
    readonly servicioNombre: any;
    readonly servicioDuracion: any;
    readonly servicioPrecio: any;
    readonly defaults: any;
    readonly showDefaults: any;
    readonly diasHorario: any;
    readonly colorFondo: any;
    readonly colorAcento: any;
    readonly paletas: {
        nombre: string;
        fondo: string;
        acento: string;
    }[];
    readonly totalSteps = 5;
    readonly progressPct: any;
    constructor();
    private loadDefaults;
    next(): void;
    back(): void;
    skip(): void;
    private validateStep1;
    private validateStep2;
    useDefault(def: ServiceDefault): void;
    selectPaleta(paleta: {
        fondo: string;
        acento: string;
    }): void;
    finish(): void;
    toggleDia(dia: DiaHorario): void;
    setHorario(dia: number, field: 'hora_inicio' | 'hora_fin', value: string): void;
    esOscuro(hex: string): boolean;
    getNombreTipo(): string;
    get diasActivosCount(): number;
}
export {};
//# sourceMappingURL=onboarding.d.ts.map