"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authInterceptor = void 0;
const core_1 = require("@angular/core");
const operators_1 = require("rxjs/operators");
const rxjs_1 = require("rxjs");
const auth_service_1 = require("../services/auth.service");
const environment_1 = require("../../../environments/environment");
// ── Estado del refresh — encapsulado en un objeto para evitar
//    que quede "colgado" entre instancias del interceptor. ──────────────────
const refreshState = {
    isRefreshing: false,
    token$: new rxjs_1.BehaviorSubject(null),
    reset() {
        this.isRefreshing = false;
        this.token$.next(null);
    },
};
// ── Interceptor ───────────────────────────────────────────────────────────
const authInterceptor = (req, next) => {
    const authService = (0, core_1.inject)(auth_service_1.AuthService);
    const isApiRequest = req.url.startsWith(environment_1.environment.apiUrl);
    if (!isApiRequest)
        return next(req);
    const token = authService.getToken();
    const authReq = token ? addToken(req, token) : req;
    return next(authReq).pipe((0, operators_1.catchError)((err) => {
        if (err.status !== 401)
            return (0, rxjs_1.throwError)(() => err);
        return handleUnauthorized(req, next, authService);
    }));
};
exports.authInterceptor = authInterceptor;
// ── Helpers ────────────────────────────────────────────────────────────────
function addToken(req, token) {
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
function handleUnauthorized(req, next, authService) {
    if (refreshState.isRefreshing) {
        // Otro request ya inició el refresh — esperar el nuevo token
        return refreshState.token$.pipe((0, operators_1.filter)((t) => t !== null), (0, operators_1.take)(1), (0, operators_1.switchMap)((newToken) => next(addToken(req, newToken))));
    }
    refreshState.isRefreshing = true;
    refreshState.token$.next(null);
    return authService.refreshToken().pipe((0, operators_1.switchMap)((newToken) => {
        refreshState.isRefreshing = false;
        refreshState.token$.next(newToken);
        return next(addToken(req, newToken));
    }), (0, operators_1.catchError)((refreshErr) => {
        refreshState.reset();
        authService.logout();
        return (0, rxjs_1.throwError)(() => refreshErr);
    }));
}
//# sourceMappingURL=auth.interceptor.js.map