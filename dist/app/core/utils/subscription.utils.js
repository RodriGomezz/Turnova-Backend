"use strict";
// src/app/core/utils/subscription.utils.ts
//
// Funciones puras — testeables sin instanciar ningún servicio.
// Reemplaza la lógica de isPro duplicada en dashboard.ts,
// app.routes.ts (proGuard) y cualquier otro componente que la repita.
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcIsPro = calcIsPro;
exports.calcTrialDaysLeft = calcTrialDaysLeft;
/**
 * Determina si un negocio tiene acceso a features Pro.
 * Un negocio es Pro si tiene plan 'pro' o 'business',
 * o si tiene un trial vigente.
 */
function calcIsPro(plan, trialEndsAt) {
    if (plan === 'pro' || plan === 'business')
        return true;
    if (!trialEndsAt)
        return false;
    return new Date(trialEndsAt) > new Date();
}
/**
 * Días restantes del trial. Null si no hay trial configurado.
 * Valor negativo indica que el trial ya venció.
 */
function calcTrialDaysLeft(trialEndsAt) {
    if (!trialEndsAt)
        return null;
    return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
//# sourceMappingURL=subscription.utils.js.map