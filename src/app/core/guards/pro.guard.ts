// src/app/core/guards/pro.guard.ts
//
// Responsabilidad única: verificar si el negocio tiene acceso Pro
// y redirigir a la tab de planes si no lo tiene.
//
// La lógica de "qué es Pro" vive en calcIsPro() —
// el guard solo orquesta, no decide la regla de negocio.

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { BusinessService } from '../services/business.service';
import { calcIsPro } from '../services/subscription.service';

export const proGuard = () => {
  const businessService = inject(BusinessService);
  const router = inject(Router);

  return businessService.get().pipe(
    map((business) => {
      const isPro = calcIsPro(business.plan, business.trial_ends_at ?? null);
      if (isPro) return true;
      return router.createUrlTree(['/panel/configuracion'], {
        queryParams: { tab: 'planes' },
      });
    }),
  );
};
