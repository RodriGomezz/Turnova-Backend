import { BusinessPlan } from '../../domain/models/business.model';
/**
 * Determina si un negocio tiene acceso a features Pro.
 * Un negocio es Pro si tiene plan 'pro' o 'business',
 * o si tiene un trial vigente.
 */
export declare function calcIsPro(plan: BusinessPlan | string, trialEndsAt: string | null): boolean;
/**
 * Días restantes del trial. Null si no hay trial configurado.
 * Valor negativo indica que el trial ya venció.
 */
export declare function calcTrialDaysLeft(trialEndsAt: string | null): number | null;
//# sourceMappingURL=subscription.utils.d.ts.map