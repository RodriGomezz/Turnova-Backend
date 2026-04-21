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
exports.ResetPassword = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const forms_1 = require("@angular/forms");
const auth_service_1 = require("../../../core/services/auth.service");
const operators_1 = require("rxjs/operators");
let ResetPassword = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-reset-password',
            standalone: true,
            imports: [router_1.RouterLink, forms_1.FormsModule],
            templateUrl: './reset-password.html',
            styleUrl: './reset-password.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ResetPassword = _classThis = class {
        constructor() {
            this.authService = (0, core_1.inject)(auth_service_1.AuthService);
            this.router = (0, core_1.inject)(router_1.Router);
            this.route = (0, core_1.inject)(router_1.ActivatedRoute);
            this.password = '';
            this.passwordConfirm = '';
            this.accessToken = '';
            this.loading = (0, core_1.signal)(false);
            this.error = (0, core_1.signal)(null);
            this.success = (0, core_1.signal)(false);
            this.showPassword = (0, core_1.signal)(false);
            this.invalidToken = (0, core_1.signal)(false);
        }
        ngOnInit() {
            // Supabase redirige con el token en el fragment de la URL
            // Ej: /reset-password#access_token=xxx&type=recovery
            const fragment = window.location.hash.substring(1);
            const params = new URLSearchParams(fragment);
            const token = params.get('access_token');
            const type = params.get('type');
            if (!token || type !== 'recovery') {
                this.invalidToken.set(true);
                return;
            }
            this.accessToken = token;
        }
        togglePassword() {
            this.showPassword.update((v) => !v);
        }
        onSubmit() {
            if (!this.password) {
                this.error.set('Ingresá una contraseña');
                return;
            }
            if (this.password.length < 8) {
                this.error.set('La contraseña debe tener al menos 8 caracteres');
                return;
            }
            if (this.password !== this.passwordConfirm) {
                this.error.set('Las contraseñas no coinciden');
                return;
            }
            this.loading.set(true);
            this.error.set(null);
            this.authService
                .resetPassword(this.accessToken, this.password)
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: () => {
                    this.success.set(true);
                    setTimeout(() => this.router.navigate(['/login']), 2500);
                },
                error: (err) => {
                    this.error.set(err.status === 401
                        ? 'El link expiró o ya fue usado. Solicitá uno nuevo.'
                        : 'Error al actualizar la contraseña. Intentá de nuevo.');
                },
            });
        }
    };
    __setFunctionName(_classThis, "ResetPassword");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ResetPassword = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ResetPassword = _classThis;
})();
exports.ResetPassword = ResetPassword;
//# sourceMappingURL=reset-password.js.map