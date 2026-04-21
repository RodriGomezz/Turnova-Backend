import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  // Si el usuario ya está en memoria (navegación normal), pasar directo.
  if (authService.currentUser()) {
    return true;
  }

  // Token válido pero sin usuario en memoria (recarga de página):
  // rehidratar antes de activar la ruta.
  return authService.me().pipe(
    map(() => true),
    catchError(() => {
      authService.logout();
      return of(false);
    }),
  );
};
