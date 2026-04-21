"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const auth_service_1 = require("../services/auth.service");
const rxjs_1 = require("rxjs");
const authGuard = () => {
    const authService = (0, core_1.inject)(auth_service_1.AuthService);
    const router = (0, core_1.inject)(router_1.Router);
    if (!authService.isLoggedIn()) {
        return router.createUrlTree(['/login']);
    }
    // Si el usuario ya está en memoria (navegación normal), pasar directo.
    if (authService.currentUser()) {
        return true;
    }
    // Token válido pero sin usuario en memoria (recarga de página):
    // rehidratar antes de activar la ruta.
    return authService.me().pipe((0, rxjs_1.map)(() => true), (0, rxjs_1.catchError)(() => {
        authService.logout();
        return (0, rxjs_1.of)(false);
    }));
};
exports.authGuard = authGuard;
//# sourceMappingURL=auth.guard.js.map