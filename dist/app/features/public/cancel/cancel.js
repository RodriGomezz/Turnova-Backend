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
exports.Cancel = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const public_service_1 = require("../../../core/services/public.service");
const subdomain_service_1 = require("../../../core/services/subdomain.service");
let Cancel = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-cancel',
            standalone: true,
            imports: [router_1.RouterLink],
            templateUrl: './cancel.html',
            styleUrl: './cancel.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Cancel = _classThis = class {
        constructor() {
            this.route = (0, core_1.inject)(router_1.ActivatedRoute);
            this.publicService = (0, core_1.inject)(public_service_1.PublicService);
            this.subdomainService = (0, core_1.inject)(subdomain_service_1.SubdomainService);
            this.slug = (0, core_1.signal)('');
            this.token = (0, core_1.signal)('');
            this.business = (0, core_1.signal)(null);
            this.status = (0, core_1.signal)('loading');
            this.errorMsg = (0, core_1.signal)('');
            this.homeLink = () => this.subdomainService.buildRouterLink(this.slug());
            this.reservarLink = () => this.subdomainService.buildRouterLink(this.slug(), 'reservar');
        }
        ngOnInit() {
            const slug = this.subdomainService.getSlug() ??
                this.route.snapshot.paramMap.get('slug') ??
                '';
            const token = this.route.snapshot.paramMap.get('token') ?? '';
            this.slug.set(slug);
            this.token.set(token);
            this.publicService.getBusiness(slug).subscribe({
                next: (res) => {
                    this.business.set(res.business);
                    this.status.set('confirm');
                },
                error: () => this.status.set('error'),
            });
        }
        cancel() {
            this.status.set('cancelling');
            this.publicService.cancelBooking(this.token()).subscribe({
                next: () => this.status.set('success'),
                error: (err) => {
                    const msg = err.error?.error ?? '';
                    if (msg.includes('24 horas')) {
                        this.status.set('too-late');
                    }
                    else if (msg.includes('ya está cancelada')) {
                        this.status.set('already-cancelled');
                    }
                    else {
                        this.errorMsg.set(msg || 'No se pudo cancelar el turno');
                        this.status.set('error');
                    }
                },
            });
        }
    };
    __setFunctionName(_classThis, "Cancel");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Cancel = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Cancel = _classThis;
})();
exports.Cancel = Cancel;
//# sourceMappingURL=cancel.js.map