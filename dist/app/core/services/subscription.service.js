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
exports.SubscriptionService = void 0;
exports.calcTrialDaysLeft = calcTrialDaysLeft;
exports.calcIsPro = calcIsPro;
exports.calcCanUseCustomDomain = calcCanUseCustomDomain;
const core_1 = require("@angular/core");
const operators_1 = require("rxjs/operators");
const environment_1 = require("../../../environments/environment");
// ── Helpers puros ─────────────────────────────────────────────────────────────
function calcTrialDaysLeft(trialEndsAt) {
    if (!trialEndsAt)
        return null;
    return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function calcIsPro(plan, trialEndsAt) {
    if (plan === 'pro' || plan === 'business')
        return true;
    if (!trialEndsAt)
        return false;
    return new Date(trialEndsAt) > new Date();
}
function calcCanUseCustomDomain(plan, _trialEndsAt) {
    return plan === 'pro' || plan === 'business';
}
// ── Servicio ───────────────────────────────────────────────────────────────────
let SubscriptionService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var SubscriptionService = _classThis = class {
        constructor(http) {
            this.http = http;
            this.api = environment_1.environment.apiUrl;
        }
        get() {
            return this.getState().pipe((0, operators_1.map)((state) => state.activeSubscription));
        }
        getState() {
            return this.http
                .get(`${this.api}/subscriptions`);
        }
        create(plan, payer) {
            return this.http
                .post(`${this.api}/subscriptions/create`, {
                plan,
                ...payer,
            })
                .pipe((0, operators_1.map)((res) => res.checkoutUrl));
        }
        cancel() {
            return this.http.delete(`${this.api}/subscriptions/cancel`, {
                body: { confirm: true },
            });
        }
    };
    __setFunctionName(_classThis, "SubscriptionService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SubscriptionService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SubscriptionService = _classThis;
})();
exports.SubscriptionService = SubscriptionService;
//# sourceMappingURL=subscription.service.js.map