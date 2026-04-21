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
exports.PreventaFundadores = void 0;
const core_1 = require("@angular/core");
const http_1 = require("@angular/common/http");
const forms_1 = require("@angular/forms");
const router_1 = require("@angular/router");
const rxjs_1 = require("rxjs");
const environment_1 = require("../../../environments/environment");
const seo_service_1 = require("../../core/services/seo.service");
let PreventaFundadores = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-preventa-fundadores',
            standalone: true,
            imports: [forms_1.FormsModule, router_1.RouterLink],
            templateUrl: './preventa-fundadores.html',
            styleUrl: './preventa-fundadores.scss',
            changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PreventaFundadores = _classThis = class {
        constructor() {
            this.http = (0, core_1.inject)(http_1.HttpClient);
            this.seo = (0, core_1.inject)(seo_service_1.SeoService);
            this.appsScriptUrl = environment_1.environment.founderWaitlistUrl;
            this.totalSpots = environment_1.environment.founderSpots;
            this.businessName = (0, core_1.signal)('');
            this.businessType = (0, core_1.signal)('');
            this.email = (0, core_1.signal)('');
            this.currentCount = (0, core_1.signal)(null);
            this.loadingCount = (0, core_1.signal)(true);
            this.countLoadError = (0, core_1.signal)(false);
            this.submitting = (0, core_1.signal)(false);
            this.submitError = (0, core_1.signal)('');
            this.duplicateEmail = (0, core_1.signal)('');
            this.successPosition = (0, core_1.signal)(null);
            this.state = (0, core_1.signal)('form');
            this.businessTypes = [
                'Barberia',
                'Peluqueria',
                'Spa / Centro estetico',
                'Consultorio medico',
                'Otro',
            ];
            this.progressPercent = (0, core_1.computed)(() => Math.min((((this.currentCount() ?? 0) / this.totalSpots) * 100), 100));
            this.remainingSpots = (0, core_1.computed)(() => Math.max(this.totalSpots - (this.currentCount() ?? 0), 0));
        }
        ngOnInit() {
            this.seo.setPageMeta({
                title: 'Kronu | Precio fundador',
                description: 'Reserva uno de los 100 lugares fundadores de Kronu y bloquea tu precio especial antes del lanzamiento.',
                path: '/fundadores',
            });
            void this.loadCount();
        }
        async submit() {
            if (this.submitting()) {
                return;
            }
            const businessName = this.businessName().trim();
            const businessType = this.businessType().trim();
            const email = this.email().trim().toLowerCase();
            if (!businessName || !businessType || !email) {
                this.submitError.set('Completa nombre del negocio, rubro y email para reservar tu lugar.');
                return;
            }
            if (!this.isValidEmail(email)) {
                this.submitError.set('Ingresa un email valido para que podamos avisarte del lanzamiento.');
                return;
            }
            this.submitting.set(true);
            this.submitError.set('');
            try {
                const payload = new FormData();
                payload.append('nombre', businessName);
                payload.append('tipo', businessType);
                payload.append('email', email);
                payload.append('fecha', new Date().toISOString());
                const response = await (0, rxjs_1.firstValueFrom)(this.http.post(this.appsScriptUrl, payload));
                if (response.status === 'ok') {
                    this.state.set('success');
                    if (response.count != null) {
                        this.currentCount.set(response.count);
                        this.countLoadError.set(false);
                        this.successPosition.set(response.count);
                    }
                    else {
                        const freshCount = await this.loadCount();
                        if (freshCount != null) {
                            this.successPosition.set(freshCount);
                        }
                    }
                    return;
                }
                if (response.status === 'duplicate') {
                    this.duplicateEmail.set(email);
                    this.state.set('duplicate');
                    return;
                }
                this.submitError.set('No pudimos guardar tu lugar ahora mismo. Intenta de nuevo en unos segundos.');
            }
            catch {
                this.submitError.set('No pudimos conectar con la lista de fundadores. Intenta de nuevo en unos segundos.');
            }
            finally {
                this.submitting.set(false);
            }
        }
        resetForm() {
            this.businessName.set('');
            this.businessType.set('');
            this.email.set('');
            this.submitError.set('');
            this.duplicateEmail.set('');
            this.successPosition.set(null);
            this.state.set('form');
        }
        async loadCount() {
            this.countLoadError.set(false);
            try {
                const response = await (0, rxjs_1.firstValueFrom)(this.http.get(`${this.appsScriptUrl}?action=count`));
                const count = response.count ?? null;
                if (count == null) {
                    this.currentCount.set(null);
                    this.countLoadError.set(true);
                    return null;
                }
                this.currentCount.set(count);
                return count;
            }
            catch {
                this.currentCount.set(null);
                this.countLoadError.set(true);
                return null;
            }
            finally {
                this.loadingCount.set(false);
            }
        }
        isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }
    };
    __setFunctionName(_classThis, "PreventaFundadores");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PreventaFundadores = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PreventaFundadores = _classThis;
})();
exports.PreventaFundadores = PreventaFundadores;
//# sourceMappingURL=preventa-fundadores.js.map