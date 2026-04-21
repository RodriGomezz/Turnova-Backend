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
exports.PublicService = void 0;
// public.service.ts
const core_1 = require("@angular/core");
const http_1 = require("@angular/common/http");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const environment_1 = require("../../../environments/environment");
let PublicService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PublicService = _classThis = class {
        constructor(http) {
            this.http = http;
            this.api = environment_1.environment.apiUrl;
            this.CACHE_TTL = 5 * 60 * 1000;
            this.cache = new Map();
        }
        getBusiness(slug) {
            const cached = this.cache.get(slug);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return (0, rxjs_1.of)(cached.data);
            }
            return this.http
                .get(`${this.api}/bookings/public/${slug}`)
                .pipe((0, operators_1.tap)((data) => this.cache.set(slug, { data, timestamp: Date.now() })));
        }
        invalidateCache(slug) {
            this.cache.delete(slug);
        }
        getSlots(slug, barberId, fecha, serviceId) {
            const params = new http_1.HttpParams()
                .set('barber_id', barberId)
                .set('fecha', fecha)
                .set('service_id', serviceId);
            return this.http.get(`${this.api}/bookings/public/${slug}/slots`, { params });
        }
        createBooking(slug, data) {
            return this.http.post(`${this.api}/bookings/public/${slug}`, data);
        }
        getAvailableDays(slug, barberId, year, month, serviceId) {
            const params = new http_1.HttpParams()
                .set('barber_id', barberId)
                .set('year', year)
                .set('month', month)
                .set('service_id', serviceId);
            return this.http.get(`${this.api}/bookings/public/${slug}/available-days`, { params });
        }
        cancelBooking(token) {
            return this.http.patch(`${this.api}/bookings/public/cancel/${token}`, {});
        }
        getBusinessByDomain(domain) {
            return this.http.get(`${this.api}/bookings/public/domain/${domain}`);
        }
        // public.service.ts — actualizar la firma
        listDefaults(tipoNegocio) {
            const params = tipoNegocio
                ? new http_1.HttpParams().set('tipo_negocio', tipoNegocio)
                : undefined;
            return this.http
                .get(`${this.api}/services/defaults`, { params })
                .pipe((0, operators_1.map)((res) => res.defaults));
        }
    };
    __setFunctionName(_classThis, "PublicService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PublicService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PublicService = _classThis;
})();
exports.PublicService = PublicService;
//# sourceMappingURL=public.service.js.map