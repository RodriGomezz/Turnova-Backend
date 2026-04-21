export interface PlanLimits {
    maxBarberos: number;
    maxReservasMes: number;
    recordatorios: boolean;
    estadisticas: boolean;
    multiSucursal: boolean;
    customDomain: boolean;
}
export declare const PLAN_LIMITS: Record<string, PlanLimits>;
export declare function getPlanLimits(plan: string, trialActivo?: boolean): PlanLimits;
//# sourceMappingURL=plan-limits.d.ts.map