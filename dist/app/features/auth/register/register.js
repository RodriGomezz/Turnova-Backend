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
exports.Register = void 0;
// register.ts
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const forms_1 = require("@angular/forms");
const auth_service_1 = require("../../../core/services/auth.service");
const tipo_negocio_1 = require("../../../core/models/tipo-negocio");
const operators_1 = require("rxjs/operators");
let Register = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-register',
            standalone: true,
            imports: [forms_1.FormsModule],
            templateUrl: './register.html',
            styleUrl: './register.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Register = _classThis = class {
        constructor() {
            this.authService = (0, core_1.inject)(auth_service_1.AuthService);
            this.router = (0, core_1.inject)(router_1.Router);
            this.nombre = '';
            this.nombreNegocio = '';
            this.slug = '';
            this.email = '';
            this.password = '';
            this.tipoNegocioValue = '';
            this.tiposNegocio = tipo_negocio_1.TIPOS_NEGOCIO;
            this.loading = (0, core_1.signal)(false);
            this.error = (0, core_1.signal)(null);
            this.success = (0, core_1.signal)(false);
            this.showPassword = (0, core_1.signal)(false);
            this.isExiting = (0, core_1.signal)(false);
        }
        // ── Slug ───────────────────────────────────────────────────────────────────
        generateSlug() {
            this.slug = this.nombreNegocio
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');
        }
        sanitizeSlug() {
            this.slug = this.slug
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '')
                .replace(/--+/g, '-');
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        get tipoSeleccionado() {
            return this.tiposNegocio.find((t) => t.value === this.tipoNegocioValue);
        }
        togglePassword() {
            this.showPassword.update((v) => !v);
        }
        goToLogin() {
            this.isExiting.set(true);
            setTimeout(() => this.router.navigate(['/login']), 280);
        }
        // ── Register ───────────────────────────────────────────────────────────────
        onRegister() {
            if (!this.nombre ||
                !this.email ||
                !this.password ||
                !this.nombreNegocio ||
                !this.slug) {
                this.error.set('Completá todos los campos');
                return;
            }
            if (!this.tipoNegocioValue) {
                this.error.set('Seleccioná el tipo de negocio');
                return;
            }
            if (this.password.length < 8) {
                this.error.set('La contraseña debe tener al menos 8 caracteres');
                return;
            }
            const tipo = this.tipoSeleccionado;
            this.loading.set(true);
            this.error.set(null);
            this.authService
                .register({
                nombre: this.nombre,
                email: this.email,
                password: this.password,
                nombre_negocio: this.nombreNegocio,
                slug: this.slug,
                tipo_negocio: tipo?.value,
                termino_profesional: tipo?.termino_profesional,
                termino_profesional_plural: tipo?.termino_profesional_plural,
                termino_servicio: tipo?.termino_servicio,
                termino_reserva: tipo?.termino_reserva,
            })
                .pipe((0, operators_1.switchMap)(() => this.authService.login(this.email, this.password)), (0, operators_1.switchMap)(() => this.authService.me()))
                .subscribe({
                next: () => {
                    this.success.set(true);
                    setTimeout(() => this.router.navigate(['/panel']), 800);
                },
                error: (err) => {
                    this.loading.set(false);
                    const msg = err.error?.error ?? '';
                    if (msg.includes('slug')) {
                        this.error.set('Ese link ya está en uso. Probá con otro.');
                    }
                    else if (msg.includes('email')) {
                        this.error.set('Ese email ya tiene una cuenta.');
                    }
                    else {
                        this.error.set('Error al crear la cuenta. Intentá de nuevo.');
                    }
                },
            });
        }
    };
    __setFunctionName(_classThis, "Register");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Register = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Register = _classThis;
})();
exports.Register = Register;
//# sourceMappingURL=register.js.map