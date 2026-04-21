"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = void 0;
exports.getPlanLimits = getPlanLimits;
exports.PLAN_LIMITS = {
    starter: {
        maxBarberos: 1,
        maxReservasMes: Infinity,
        recordatorios: false,
        estadisticas: false,
        multiSucursal: false,
        customDomain: false,
    },
    pro: {
        maxBarberos: 5,
        maxReservasMes: Infinity,
        recordatorios: true,
        estadisticas: true,
        multiSucursal: false,
        customDomain: true,
    },
    business: {
        maxBarberos: Infinity,
        maxReservasMes: Infinity,
        recordatorios: true,
        estadisticas: true,
        multiSucursal: true,
        customDomain: true,
    },
};
function getPlanLimits(plan, trialActivo = false) {
    if (trialActivo) {
        return exports.PLAN_LIMITS["pro"]; // Trial = acceso Pro completo
    }
    return exports.PLAN_LIMITS[plan] ?? exports.PLAN_LIMITS["starter"];
}
//# sourceMappingURL=plan-limits.js.map