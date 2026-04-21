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
exports.PublicHome = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const public_service_1 = require("../../../core/services/public.service");
const subdomain_service_1 = require("../../../core/services/subdomain.service");
const color_utils_1 = require("../../../core/utils/color.utils");
let PublicHome = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-public-home',
            standalone: true,
            imports: [router_1.RouterLink],
            templateUrl: './public-home.html',
            styleUrl: './public-home.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PublicHome = _classThis = class {
        constructor() {
            this.route = (0, core_1.inject)(router_1.ActivatedRoute);
            this.publicService = (0, core_1.inject)(public_service_1.PublicService);
            this.subdomainService = (0, core_1.inject)(subdomain_service_1.SubdomainService);
            this.business = (0, core_1.signal)(null);
            this.barbers = (0, core_1.signal)([]);
            this.services = (0, core_1.signal)([]);
            this.loading = (0, core_1.signal)(true);
            this.notFound = (0, core_1.signal)(false);
            this.slug = (0, core_1.signal)('');
            // ── Computeds de color ─────────────────────────────────────────────────────
            this.colorTexto = (0, core_1.computed)(() => (0, color_utils_1.colorTextoSobre)(this.business()?.color_fondo ?? '#0A0A0A'));
            this.colorTextoSuave = (0, core_1.computed)(() => (0, color_utils_1.esOscuro)(this.business()?.color_fondo ?? '#0A0A0A')
                ? 'rgba(245,242,236,0.6)'
                : 'rgba(10,10,10,0.5)');
            this.colorSuperficie = (0, core_1.computed)(() => (0, color_utils_1.esOscuro)(this.business()?.color_fondo ?? '#0A0A0A')
                ? 'color-mix(in srgb, var(--bg) 80%, white)'
                : '#FFFFFF');
            this.colorSobreAccento = (0, core_1.computed)(() => (0, color_utils_1.colorTextoSobre)(this.business()?.color_acento ?? '#C9A84C'));
            this.heroImageUrl = (0, core_1.computed)(() => {
                const url = this.business()?.hero_imagen_url;
                return url ? `${url}?t=${Date.now()}` : null;
            });
            this.colorAcentoSobreSuperficie = (0, core_1.computed)(() => {
                const acento = this.business()?.color_acento ?? '#C9A84C';
                const r = parseInt(acento.slice(1, 3), 16);
                const g = parseInt(acento.slice(3, 5), 16);
                const b = parseInt(acento.slice(5, 7), 16);
                const lum = r * 0.299 + g * 0.587 + b * 0.114;
                if (lum > 180)
                    return '#1C1C1E';
                if (lum > 190) {
                    const f = 0.65;
                    return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
                }
                return acento;
            });
            this.colorSeccionDark = (0, core_1.computed)(() => {
                const bg = this.business()?.color_fondo ?? '#0A0A0A';
                const r = parseInt(bg.slice(1, 3), 16);
                const g = parseInt(bg.slice(3, 5), 16);
                const b = parseInt(bg.slice(5, 7), 16);
                const lum = r * 0.299 + g * 0.587 + b * 0.114;
                return lum < 60 ? bg : '#0A0A0A';
            });
            this.colorOnAcentoSobreSuperficie = (0, core_1.computed)(() => {
                const acentoSup = this.colorAcentoSobreSuperficie();
                if (acentoSup === '#1C1C1E' || acentoSup.startsWith('rgb('))
                    return '#F5F2EC';
                return (0, color_utils_1.colorTextoSobre)(acentoSup);
            });
            this.isDisponible = (0, core_1.computed)(() => {
                const s = this.business()?.status;
                return s === 'active' || s === 'trial';
            });
            this.reservarLink = (0, core_1.computed)(() => this.subdomainService.buildRouterLink(this.slug(), 'reservar'));
            this.onDarkSection = '#F5F2EC';
            this.onDarkSectionSoft = 'rgba(245,242,236,0.6)';
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            let slug = this.subdomainService.getSlug() ??
                this.route.snapshot.paramMap.get('slug') ??
                '';
            // Si es dominio personalizado, resolver por hostname
            if (!slug && this.subdomainService.isCustomDomain()) {
                const domain = window.location.hostname;
                this.publicService.getBusinessByDomain(domain).subscribe({
                    next: (res) => {
                        this.slug.set(res.business.slug);
                        this.business.set(res.business);
                        this.barbers.set(res.barbers);
                        this.services.set(res.services);
                        this.loading.set(false);
                    },
                    error: () => {
                        this.notFound.set(true);
                        this.loading.set(false);
                    },
                });
                return;
            }
            this.slug.set(slug);
            this.publicService.getBusiness(slug).subscribe({
                next: (res) => {
                    this.business.set(res.business);
                    this.barbers.set(res.barbers);
                    this.services.set(res.services);
                    this.loading.set(false);
                },
                error: () => {
                    this.notFound.set(true);
                    this.loading.set(false);
                },
            });
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        esOscuro(hex) {
            return (0, color_utils_1.esOscuro)(hex);
        }
        formatPrecio(service) {
            const base = `$${service.precio.toLocaleString('es-UY')}`;
            return service.precio_hasta
                ? `${base} – $${service.precio_hasta.toLocaleString('es-UY')}`
                : base;
        }
    };
    __setFunctionName(_classThis, "PublicHome");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PublicHome = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PublicHome = _classThis;
})();
exports.PublicHome = PublicHome;
//# sourceMappingURL=public-home.js.map