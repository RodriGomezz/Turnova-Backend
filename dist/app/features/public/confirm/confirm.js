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
exports.Confirm = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const common_1 = require("@angular/common");
const public_service_1 = require("../../../core/services/public.service");
const subdomain_service_1 = require("../../../core/services/subdomain.service");
let Confirm = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-confirm',
            standalone: true,
            imports: [router_1.RouterLink, common_1.TitleCasePipe],
            templateUrl: './confirm.html',
            styleUrl: './confirm.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Confirm = _classThis = class {
        constructor() {
            this.route = (0, core_1.inject)(router_1.ActivatedRoute);
            this.publicService = (0, core_1.inject)(public_service_1.PublicService);
            this.subdomainService = (0, core_1.inject)(subdomain_service_1.SubdomainService);
            this.slug = (0, core_1.signal)('');
            this.nombre = (0, core_1.signal)('');
            this.fecha = (0, core_1.signal)('');
            this.hora = (0, core_1.signal)('');
            this.servicio = (0, core_1.signal)('');
            this.barbero = (0, core_1.signal)('');
            this.estado = (0, core_1.signal)('confirmada');
            this.business = (0, core_1.signal)(null);
            this.homeLink = () => this.subdomainService.buildRouterLink(this.slug());
            this.reservarLink = () => this.subdomainService.buildRouterLink(this.slug(), 'reservar');
        }
        ngOnInit() {
            const slug = this.subdomainService.getSlug() ??
                this.route.snapshot.paramMap.get('slug') ??
                '';
            this.slug.set(slug);
            const q = this.route.snapshot.queryParamMap;
            this.nombre.set(q.get('nombre') ?? '');
            this.fecha.set(q.get('fecha') ?? '');
            this.hora.set(q.get('hora') ?? '');
            this.servicio.set(q.get('servicio') ?? '');
            this.barbero.set(q.get('barbero') ?? '');
            this.estado.set(q.get('estado') ?? 'confirmada');
            this.publicService.getBusiness(slug).subscribe({
                next: (res) => this.business.set(res.business),
            });
        }
        formatFecha(fecha) {
            if (!fecha)
                return '';
            return new Date(fecha + 'T00:00:00').toLocaleDateString('es-UY', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
            });
        }
    };
    __setFunctionName(_classThis, "Confirm");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Confirm = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Confirm = _classThis;
})();
exports.Confirm = Confirm;
//# sourceMappingURL=confirm.js.map