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
exports.BusinessStatusService = void 0;
const core_1 = require("@angular/core");
const business_service_1 = require("./business.service");
const subscription_service_1 = require("./subscription.service");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const TRIAL_GRACE_DAYS = 14;
let BusinessStatusService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var BusinessStatusService = _classThis = class {
        constructor() {
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.subscriptionService = (0, core_1.inject)(subscription_service_1.SubscriptionService);
            this.business = (0, core_1.signal)(null);
            this.subscription = (0, core_1.signal)(null);
            this.loaded = (0, core_1.signal)(false);
            this.planStatus = (0, core_1.computed)(() => {
                const b = this.business();
                const s = this.subscription();
                if (!b)
                    return 'starter';
                const now = Date.now();
                const trialEnd = b.trial_ends_at ? new Date(b.trial_ends_at).getTime() : null;
                // Suscripción activa — tiene máxima prioridad, ignora trial
                if (s?.status === 'active') {
                    if (b.plan === 'pro')
                        return 'pro_active';
                    if (b.plan === 'business')
                        return 'business_active';
                    return 'starter'; // suscripción activa a Starter
                }
                if (s?.status === 'past_due')
                    return 'payment_pending';
                if (s?.status === 'grace_period')
                    return 'payment_grace';
                // Sin suscripción activa — evaluar trial
                if (trialEnd && trialEnd > now)
                    return 'trial_active';
                if (trialEnd && trialEnd <= now) {
                    const daysSinceExpiry = (now - trialEnd) / (1000 * 60 * 60 * 24);
                    if (daysSinceExpiry <= TRIAL_GRACE_DAYS)
                        return 'trial_grace';
                    return 'trial_expired';
                }
                return 'starter';
            });
            this.isPro = (0, core_1.computed)(() => {
                const status = this.planStatus();
                return (status === 'trial_active' ||
                    status === 'trial_grace' ||
                    status === 'pro_active' ||
                    status === 'business_active');
            });
            this.isBusiness = (0, core_1.computed)(() => this.planStatus() === 'business_active');
            this.trialDaysLeft = (0, core_1.computed)(() => {
                const b = this.business();
                if (!b?.trial_ends_at)
                    return null;
                const days = Math.ceil((new Date(b.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return days > 0 ? days : null;
            });
            this.trialGraceDaysLeft = (0, core_1.computed)(() => {
                const b = this.business();
                if (!b?.trial_ends_at)
                    return null;
                const trialEnd = new Date(b.trial_ends_at).getTime();
                const graceEnd = trialEnd + TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000;
                const days = Math.ceil((graceEnd - Date.now()) / (1000 * 60 * 60 * 24));
                return days > 0 ? days : null;
            });
            /**
             * Banner informativo — solo se muestra si no hay suscripción activa
             * o si hay un problema de pago.
             */
            this.bannerInfo = (0, core_1.computed)(() => {
                const status = this.planStatus();
                const trialLeft = this.trialDaysLeft();
                const graceLeft = this.trialGraceDaysLeft();
                switch (status) {
                    case 'pro_active':
                    case 'business_active':
                    case 'starter':
                        // Suscripción activa o Starter sin trial — sin banner
                        return { type: null, message: '' };
                    case 'trial_active':
                        if (trialLeft !== null && trialLeft <= 7) {
                            return { type: 'warning', message: `Tu período de prueba vence en ${trialLeft} día${trialLeft !== 1 ? 's' : ''}. Suscribite para no perder el acceso Pro.` };
                        }
                        return { type: 'info', message: `Trial activo — ${trialLeft} días restantes con acceso Pro completo.` };
                    case 'trial_grace':
                        return { type: 'warning', message: `Tu trial venció. Tenés ${graceLeft} día${graceLeft !== 1 ? 's' : ''} antes de bajar a Starter. Suscribite ahora.` };
                    case 'trial_expired':
                        return { type: 'danger', message: 'Tu período de prueba venció. Suscribite para recuperar todas las funcionalidades.' };
                    case 'payment_pending':
                        return { type: 'warning', message: 'Tuvimos un problema con tu pago. Lo estamos reintentando automáticamente.' };
                    case 'payment_grace':
                        return { type: 'danger', message: 'Los reintentos de pago se agotaron. Actualizá tu método de pago antes de perder el acceso Pro.' };
                    default:
                        return { type: null, message: '' };
                }
            });
        }
        load() {
            return (0, rxjs_1.forkJoin)({
                business: this.businessService.get(),
                subscription: this.subscriptionService.get(),
            }).pipe((0, operators_1.tap)(({ business, subscription }) => {
                this.business.set(business);
                this.subscription.set(subscription);
                this.loaded.set(true);
            }));
        }
        refresh() {
            this.loaded.set(false);
            return this.load();
        }
    };
    __setFunctionName(_classThis, "BusinessStatusService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BusinessStatusService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BusinessStatusService = _classThis;
})();
exports.BusinessStatusService = BusinessStatusService;
//# sourceMappingURL=business-status.service.js.map