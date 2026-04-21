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
exports.BusinessService = void 0;
// business.service.ts
const core_1 = require("@angular/core");
const operators_1 = require("rxjs/operators");
const environment_1 = require("../../../environments/environment");
let BusinessService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var BusinessService = _classThis = class {
        constructor(http) {
            this.http = http;
            this.api = environment_1.environment.apiUrl;
        }
        get() {
            return this.http
                .get(`${this.api}/business`)
                .pipe((0, operators_1.map)((res) => res.business));
        }
        update(data) {
            return this.http
                .put(`${this.api}/business`, data)
                .pipe((0, operators_1.map)((res) => res.business));
        }
        getStatus() {
            return this.http.get(`${this.api}/business/status`);
        }
        completeOnboarding() {
            return this.http.patch(`${this.api}/business/onboarding`, {});
        }
        switchBusiness(businessId) {
            return this.http.patch(`${this.api}/business/switch`, {
                business_id: businessId,
            });
        }
        listUserBusinesses() {
            return this.http
                .get(`${this.api}/business/all`, {
                headers: { 'Cache-Control': 'no-cache' },
            })
                .pipe((0, operators_1.map)((res) => res.businesses));
        }
        deactivateBranch(id) {
            return this.http.patch(`${this.api}/business/${id}/deactivate`, {});
        }
        reactivateBranch(id) {
            return this.http.patch(`${this.api}/business/${id}/reactivate`, {});
        }
        deleteBranch(id) {
            return this.http.delete(`${this.api}/business/${id}`);
        }
    };
    __setFunctionName(_classThis, "BusinessService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BusinessService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BusinessService = _classThis;
})();
exports.BusinessService = BusinessService;
//# sourceMappingURL=business.service.js.map