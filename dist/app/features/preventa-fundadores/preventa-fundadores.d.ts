import { OnInit } from '@angular/core';
type BusinessType = '' | 'Barberia' | 'Peluqueria' | 'Spa / Centro estetico' | 'Consultorio medico' | 'Otro';
export declare class PreventaFundadores implements OnInit {
    private readonly http;
    private readonly seo;
    private readonly appsScriptUrl;
    private readonly totalSpots;
    protected readonly businessName: any;
    protected readonly businessType: any;
    protected readonly email: any;
    protected readonly currentCount: any;
    protected readonly loadingCount: any;
    protected readonly countLoadError: any;
    protected readonly submitting: any;
    protected readonly submitError: any;
    protected readonly duplicateEmail: any;
    protected readonly successPosition: any;
    protected readonly state: any;
    protected readonly businessTypes: Exclude<BusinessType, ''>[];
    protected readonly progressPercent: any;
    protected readonly remainingSpots: any;
    ngOnInit(): void;
    protected submit(): Promise<void>;
    protected resetForm(): void;
    private loadCount;
    private isValidEmail;
}
export {};
//# sourceMappingURL=preventa-fundadores.d.ts.map