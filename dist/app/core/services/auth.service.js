"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const core_1 = require("@angular/core");
const operators_1 = require("rxjs/operators");
const rxjs_1 = require("rxjs");
const environment_1 = require("../../../environments/environment");
let AuthService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AuthService = _classThis = class {
        constructor(http, router, terminologyService) {
            this.http = http;
            this.router = router;
            this.terminologyService = terminologyService;
            this.TOKEN_KEY = 'turnio_token';
            this.REFRESH_TOKEN_KEY = 'turnio_refresh_token';
            this.apiUrl = environment_1.environment.apiUrl;
            this._currentUser = (0, core_1.signal)(null);
            this.currentUser = this._currentUser.asReadonly();
            this.availableBusinesses = (0, core_1.signal)([]);
        }
        // ── Auth ───────────────────────────────────────────────────────────────────
        register(data) {
            return this.http.post(`${this.apiUrl}/auth/register`, data);
        }
        login(email, password) {
            return this.http
                .post(`${this.apiUrl}/auth/login`, { email, password })
                .pipe((0, operators_1.tap)((res) => {
                localStorage.setItem(this.TOKEN_KEY, res.token);
                if (res.refresh_token) {
                    localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refresh_token);
                }
            }));
        }
        me() {
            return this.http
                .get(`${this.apiUrl}/auth/me`)
                .pipe((0, operators_1.tap)((res) => {
                this._currentUser.set(res.user);
                this.availableBusinesses.set(res.businesses ?? []);
            }), (0, operators_1.map)((res) => res.user));
        }
        createBranch(nombre, slug) {
            return this.http.post(`${this.apiUrl}/auth/branch`, { nombre, slug });
        }
        logout() {
            localStorage.removeItem(this.TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
            this._currentUser.set(null);
            this.terminologyService.clear();
            this.router.navigate(['/login']);
        }
        getToken() {
            return localStorage.getItem(this.TOKEN_KEY);
        }
        // ── Session ────────────────────────────────────────────────────────────────
        isLoggedIn() {
            const token = this.getToken();
            if (!token)
                return false;
            return !this.isTokenExpired(token);
        }
        // Validación client-side — no reemplaza verificación de firma en el backend.
        isTokenExpired(token) {
            try {
                const parts = token.split('.');
                if (parts.length !== 3)
                    return true;
                const payload = JSON.parse(atob(parts[1]));
                if (typeof payload.exp !== 'number')
                    return true;
                const bufferMs = 30000;
                return payload.exp * 1000 < Date.now() + bufferMs;
            }
            catch {
                return true;
            }
        }
        // ── Refresh ────────────────────────────────────────────────────────────────
        refreshToken() {
            const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
            if (!refreshToken) {
                this.logout();
                return (0, rxjs_1.throwError)(() => new Error('Session expired. Please log in again.'));
            }
            return this.http
                .post(`${this.apiUrl}/auth/refresh`, {
                refresh_token: refreshToken,
            })
                .pipe((0, operators_1.tap)((res) => {
                localStorage.setItem(this.TOKEN_KEY, res.token);
                if (res.refresh_token) {
                    localStorage.setItem(this.REFRESH_TOKEN_KEY, res.refresh_token);
                }
            }), (0, operators_1.map)((res) => res.token));
        }
        // dentro de la clase AuthService:
        updateProfile(data) {
            return this.http.put(`${this.apiUrl}/auth/profile`, data);
        }
        requestPasswordReset(email) {
            return this.http.post(`${this.apiUrl}/auth/request-reset`, { email });
        }
        resetPassword(accessToken, password) {
            return this.http.post(`${this.apiUrl}/auth/reset-password`, {
                access_token: accessToken,
                password,
            });
        }
    };
    __setFunctionName(_classThis, "AuthService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuthService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthService = _classThis;
})();
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map