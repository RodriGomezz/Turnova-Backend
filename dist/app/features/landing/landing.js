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
exports.Landing = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
let Landing = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-landing',
            standalone: true,
            imports: [router_1.RouterLink],
            templateUrl: './landing.html',
            styleUrl: './landing.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Landing = _classThis = class {
        constructor() {
            this.openFaq = (0, core_1.signal)(null);
            this.faqItems = (0, core_1.signal)([
                {
                    q: '¿Necesito saber de tecnología para configurarlo?',
                    a: 'No. Si sabe usar Instagram, sabe usar Turnio. El proceso de configuración toma menos de 10 minutos y no requiere ningún conocimiento técnico.',
                },
                {
                    q: '¿Mis clientes necesitan crear una cuenta para reservar?',
                    a: 'No. Sus clientes entran a su página, eligen servicio, profesional y horario, ingresan su nombre y email, y listo. Sin registros, sin contraseñas.',
                },
                {
                    q: '¿Qué pasa si quiero cancelar mi suscripción?',
                    a: 'Puede cancelar en cualquier momento desde su panel, sin penalizaciones ni trámites. Su cuenta pasa al plan Starter automáticamente.',
                },
                {
                    q: '¿Puedo cambiar de plan cuando quiera?',
                    a: 'Sí. Puede subir o bajar de plan en cualquier momento desde la configuración de su cuenta.',
                },
                {
                    q: '¿Los pagos online están incluidos?',
                    a: 'Todavía no. Los pagos con MercadoPago Uruguay estarán disponibles próximamente. Por ahora, el cobro se realiza en el local al momento del servicio.',
                },
                {
                    q: '¿Turnio funciona en el celular?',
                    a: 'Sí. Tanto el panel del dueño como la página de reservas están optimizados para celular. No hay app que descargar.',
                },
            ]);
        }
        toggleFaq(q) {
            this.openFaq.set(this.openFaq() === q ? null : q);
        }
    };
    __setFunctionName(_classThis, "Landing");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Landing = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Landing = _classThis;
})();
exports.Landing = Landing;
//# sourceMappingURL=landing.js.map