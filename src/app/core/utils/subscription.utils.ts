// src/app/core/utils/subscription.utils.ts
//
// Funciones puras — testeables sin instanciar ningún servicio.
// Reemplaza la lógica de isPro duplicada en dashboard.ts,
// app.routes.ts (proGuard) y cualquier otro componente que la repita.

import { BusinessPlan } from '../../domain/models/business.model';

/**
 * Determina si un negocio tiene acceso a features Pro.
 * Un negocio es Pro si tiene plan 'pro' o 'business',
 * o si tiene un trial vigente.
 */
export function calcIsPro(
  plan: BusinessPlan | string,
  trialEndsAt: string | null,
): boolean {
  if (plan === 'pro' || plan === 'business') return true;
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) > new Date();
}

/**
 * Días restantes del trial. Null si no hay trial configurado.
 * Valor negativo indica que el trial ya venció.
 */
export function calcTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil(
    (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}
