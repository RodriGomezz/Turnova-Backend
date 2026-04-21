import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessStatusService } from '../services/business-status.service';
import { map, switchMap, of } from 'rxjs';

/**
 * Bloquea rutas Pro/Business si el trial venció y no hay suscripción activa.
 * Redirige a configuración → tab planes para que el usuario se suscriba.
 */
export const trialExpiredGuard: CanActivateFn = () => {
  const statusService = inject(BusinessStatusService);
  const router        = inject(Router);

  const check = () => {
    const status = statusService.planStatus();
    if (status === 'trial_expired') {
      return router.createUrlTree(['/panel/configuracion'], {
        queryParams: { tab: 'planes', motivo: 'trial_vencido' },
      });
    }
    return true;
  };

  // Si ya está cargado, verificar directo
  if (statusService.loaded()) return check();

  // Si no, cargar primero
  return statusService.load().pipe(map(() => check()));
};

/**
 * Guard para rutas exclusivas de Pro/Business.
 * Si el usuario está en Starter o trial expirado, redirige a planes.
 */
export const proRequiredGuard: CanActivateFn = () => {
  const statusService = inject(BusinessStatusService);
  const router        = inject(Router);

  const check = () => {
    if (!statusService.isPro()) {
      return router.createUrlTree(['/panel/configuracion'], {
        queryParams: { tab: 'planes' },
      });
    }
    return true;
  };

  if (statusService.loaded()) return check();
  return statusService.load().pipe(map(() => check()));
};
