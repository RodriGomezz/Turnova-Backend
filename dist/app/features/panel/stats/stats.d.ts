import { OnInit } from '@angular/core';
export declare class Stats implements OnInit {
    private readonly statsService;
    private readonly barberService;
    private readonly toastService;
    readonly terms: any;
    readonly loading: any;
    readonly stats: any;
    readonly barbers: any;
    readonly statsYear: any;
    readonly statsMonth: any;
    readonly MESES: string[];
    readonly mesLabel: any;
    readonly topProfesionalNombre: any;
    readonly isCurrentMonth: any;
    readonly maxDayCount: any;
    readonly maxHoraCount: any;
    readonly mejorDia: any;
    readonly promedioTurnosDia: any;
    readonly ingresoPromedioPorTurno: any;
    ngOnInit(): void;
    loadStats(): void;
    prevMes(): void;
    nextMes(): void;
    formatVariacion(v: number | null): string;
    formatFecha(fecha: string): string;
    getDayBarHeight(total: number): number;
    getHoraBarHeight(count: number): number;
    getPorDiaLast15(): {
        fecha: string;
        total: number;
        day: number;
    }[];
    get tasaRetencion(): number;
}
//# sourceMappingURL=stats.d.ts.map