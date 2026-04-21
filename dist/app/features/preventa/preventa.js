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
exports.Preventa = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const environment_1 = require("../../../environments/environment");
const seo_service_1 = require("../../core/services/seo.service");
let Preventa = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-preventa',
            standalone: true,
            imports: [router_1.RouterLink],
            templateUrl: './preventa.html',
            styleUrl: './preventa.scss',
            changeDetection: core_1.ChangeDetectionStrategy.OnPush,
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Preventa = _classThis = class {
        constructor() {
            this.seo = (0, core_1.inject)(seo_service_1.SeoService);
            this.launchDate = new Date(environment_1.environment.prelaunchLaunchDate);
            this.timerId = null;
            this.countdown = (0, core_1.signal)({
                days: '00',
                hours: '00',
                minutes: '00',
                seconds: '00',
            });
            this.launchReached = (0, core_1.signal)(false);
            this.chips = [
                'Reservas online 24/7',
                'Recordatorios automaticos',
                'Sin WhatsApp, sin llamadas',
                '30 dias gratis',
            ];
            this.countdownUnits = (0, core_1.computed)(() => [
                { label: 'Dias', value: this.countdown().days },
                { label: 'Horas', value: this.countdown().hours },
                { label: 'Minutos', value: this.countdown().minutes },
                { label: 'Segundos', value: this.countdown().seconds },
            ]);
        }
        ngOnInit() {
            this.seo.setPageMeta({
                title: 'Kronu | Preventa para barberias y peluquerias',
                description: 'Asegura tu lugar fundador en Kronu y lanza tu negocio con reservas online, recordatorios y una pagina propia.',
                path: '/',
            });
            this.updateCountdown();
            this.timerId = setInterval(() => this.updateCountdown(), 1000);
        }
        ngOnDestroy() {
            if (this.timerId) {
                clearInterval(this.timerId);
            }
        }
        updateCountdown() {
            const diff = this.launchDate.getTime() - Date.now();
            if (diff <= 0) {
                this.launchReached.set(true);
                this.countdown.set({
                    days: '00',
                    hours: '00',
                    minutes: '00',
                    seconds: '00',
                });
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
                return;
            }
            this.launchReached.set(false);
            const totalSeconds = Math.floor(diff / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            this.countdown.set({
                days: this.pad(days),
                hours: this.pad(hours),
                minutes: this.pad(minutes),
                seconds: this.pad(seconds),
            });
        }
        pad(value) {
            return value.toString().padStart(2, '0');
        }
    };
    __setFunctionName(_classThis, "Preventa");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Preventa = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Preventa = _classThis;
})();
exports.Preventa = Preventa;
//# sourceMappingURL=preventa.js.map