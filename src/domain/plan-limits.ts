export interface PlanLimits {
  maxBarberos: number;
  maxReservasMes: number;
  recordatorios: boolean;
  estadisticas: boolean;
  multiSucursal: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    maxBarberos: 1,
    maxReservasMes: Infinity,
    recordatorios: false,
    estadisticas: false,
    multiSucursal: false,
  },
  pro: {
    maxBarberos: 5,
    maxReservasMes: Infinity,
    recordatorios: true,
    estadisticas: true,
    multiSucursal: false,
  },
  business: {
    maxBarberos: Infinity,
    maxReservasMes: Infinity,
    recordatorios: true,
    estadisticas: true,
    multiSucursal: true,
  },
};

export function getPlanLimits(plan: string, trialActivo = false): PlanLimits {
  if (trialActivo) {
    return PLAN_LIMITS["pro"]; // Trial = acceso Pro completo
  }
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS["starter"];
}
