import { CanActivateFn } from '@angular/router';
/**
 * Bloquea rutas Pro/Business si el trial venció y no hay suscripción activa.
 * Redirige a configuración → tab planes para que el usuario se suscriba.
 */
export declare const trialExpiredGuard: CanActivateFn;
/**
 * Guard para rutas exclusivas de Pro/Business.
 * Si el usuario está en Starter o trial expirado, redirige a planes.
 */
export declare const proRequiredGuard: CanActivateFn;
//# sourceMappingURL=trial-expired.guard.d.ts.map