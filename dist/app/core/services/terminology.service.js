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
exports.TerminologyService = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const CACHE_KEY = 'turnio_terms';
const DEFAULTS = {
    profesional: 'Barbero',
    profesionalPlural: 'Barberos',
    servicio: 'Servicio',
    reserva: 'Turno',
};
let TerminologyService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TerminologyService = _classThis = class {
        constructor(businessService) {
            this.businessService = businessService;
            this._terms = (0, core_1.signal)(this.readCache());
            this.terms = this._terms.asReadonly();
            this.profesional = (0, core_1.computed)(() => this._terms().profesional);
            this.profesionalPlural = (0, core_1.computed)(() => this._terms().profesionalPlural);
            this.servicio = (0, core_1.computed)(() => this._terms().servicio);
            this.reserva = (0, core_1.computed)(() => this._terms().reserva);
        }
        load() {
            return this.businessService.get().pipe((0, rxjs_1.tap)((business) => {
                const terms = {
                    profesional: business.termino_profesional,
                    profesionalPlural: business.termino_profesional_plural,
                    servicio: business.termino_servicio,
                    reserva: business.termino_reserva,
                };
                this._terms.set(terms);
                this.writeCache(terms);
            }), (0, operators_1.map)(() => void 0));
        }
        update(terms) {
            this._terms.set(terms);
            this.writeCache(terms);
        }
        clear() {
            try {
                localStorage.removeItem(CACHE_KEY);
            }
            catch {
                /* storage no disponible */
            }
        }
        readCache() {
            try {
                const raw = localStorage.getItem(CACHE_KEY);
                if (raw)
                    return JSON.parse(raw);
            }
            catch {
                /* storage no disponible — usar defaults */
            }
            return DEFAULTS;
        }
        writeCache(terms) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(terms));
            }
            catch {
                /* storage no disponible */
            }
        }
    };
    __setFunctionName(_classThis, "TerminologyService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TerminologyService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TerminologyService = _classThis;
})();
exports.TerminologyService = TerminologyService;
//# sourceMappingURL=terminology.service.js.map