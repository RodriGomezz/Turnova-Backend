"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorInterceptor = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
const toast_service_1 = require("../services/toast.service");
const errorInterceptor = (req, next) => {
    const toastService = (0, core_1.inject)(toast_service_1.ToastService);
    return next(req).pipe((0, rxjs_1.catchError)((error) => {
        // 401 es responsabilidad del authInterceptor — no lo tocamos aquí.
        if (error.status === 401) {
            return (0, rxjs_1.throwError)(() => error);
        }
        const message = error.error?.message ?? getDefaultMessage(error.status);
        toastService.error(message);
        return (0, rxjs_1.throwError)(() => error);
    }));
};
exports.errorInterceptor = errorInterceptor;
function getDefaultMessage(status) {
    const messages = {
        400: 'Solicitud inválida.',
        403: 'No tenés permiso para realizar esta acción.',
        404: 'El recurso solicitado no existe.',
        422: 'Los datos enviados no son válidos.',
        500: 'Error interno del servidor. Intentá de nuevo.',
        503: 'Servicio no disponible. Intentá más tarde.',
    };
    return messages[status] ?? 'Ocurrió un error inesperado.';
}
//# sourceMappingURL=error.interceptor.js.map