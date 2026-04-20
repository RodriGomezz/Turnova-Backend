// error.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error) => {
      // 401 es responsabilidad del authInterceptor — no lo tocamos aquí.
      if (error.status === 401) {
        return throwError(() => error);
      }

      const message = error.error?.message ?? getDefaultMessage(error.status);
      toastService.error(message);

      return throwError(() => error);
    }),
  );
};

function getDefaultMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Solicitud inválida.',
    403: 'No tenés permiso para realizar esta acción.',
    404: 'El recurso solicitado no existe.',
    422: 'Los datos enviados no son válidos.',
    500: 'Error interno del servidor. Intentá de nuevo.',
    503: 'Servicio no disponible. Intentá más tarde.',
  };
  return messages[status] ?? 'Ocurrió un error inesperado.';
}
