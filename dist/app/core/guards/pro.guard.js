"use strict";
// src/app/core/guards/pro.guard.ts
//
// Responsabilidad única: verificar si el negocio tiene acceso Pro
// y redirigir a la tab de planes si no lo tiene.
//
// La lógica de "qué es Pro" vive en calcIsPro() —
// el guard solo orquesta, no decide la regla de negocio.
Object.defineProperty(exports, "__esModule", { value: true });
exports.proGuard = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const operators_1 = require("rxjs/operators");
const business_service_1 = require("../services/business.service");
const subscription_service_1 = require("../services/subscription.service");
const proGuard = () => {
    const businessService = (0, core_1.inject)(business_service_1.BusinessService);
    const router = (0, core_1.inject)(router_1.Router);
    return businessService.get().pipe((0, operators_1.map)((business) => {
        const isPro = (0, subscription_service_1.calcIsPro)(business.plan, business.trial_ends_at ?? null);
        if (isPro)
            return true;
        return router.createUrlTree(['/panel/configuracion'], {
            queryParams: { tab: 'planes' },
        });
    }));
};
exports.proGuard = proGuard;
//# sourceMappingURL=pro.guard.js.map