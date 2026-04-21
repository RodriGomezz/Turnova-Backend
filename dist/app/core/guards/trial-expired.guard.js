"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proRequiredGuard = exports.trialExpiredGuard = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const business_status_service_1 = require("../services/business-status.service");
const rxjs_1 = require("rxjs");
/**
 * Bloquea rutas Pro/Business si el trial venció y no hay suscripción activa.
 * Redirige a configuración → tab planes para que el usuario se suscriba.
 */
const trialExpiredGuard = () => {
    const statusService = (0, core_1.inject)(business_status_service_1.BusinessStatusService);
    const router = (0, core_1.inject)(router_1.Router);
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
    if (statusService.loaded())
        return check();
    // Si no, cargar primero
    return statusService.load().pipe((0, rxjs_1.map)(() => check()));
};
exports.trialExpiredGuard = trialExpiredGuard;
/**
 * Guard para rutas exclusivas de Pro/Business.
 * Si el usuario está en Starter o trial expirado, redirige a planes.
 */
const proRequiredGuard = () => {
    const statusService = (0, core_1.inject)(business_status_service_1.BusinessStatusService);
    const router = (0, core_1.inject)(router_1.Router);
    const check = () => {
        if (!statusService.isPro()) {
            return router.createUrlTree(['/panel/configuracion'], {
                queryParams: { tab: 'planes' },
            });
        }
        return true;
    };
    if (statusService.loaded())
        return check();
    return statusService.load().pipe((0, rxjs_1.map)(() => check()));
};
exports.proRequiredGuard = proRequiredGuard;
//# sourceMappingURL=trial-expired.guard.js.map