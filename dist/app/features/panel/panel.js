"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Panel = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const auth_service_1 = require("../../core/services/auth.service");
const business_service_1 = require("../../core/services/business.service");
const toast_1 = require("../../shared/toast");
const terminology_service_1 = require("../../core/services/terminology.service");
const toast_service_1 = require("../../core/services/toast.service");
const business_status_service_1 = require("../../core/services/business-status.service");
const plan_banner_1 = require("./plan-banner/plan-banner");
let Panel = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-panel',
            standalone: true,
            imports: [router_1.RouterLink, router_1.RouterLinkActive, router_1.RouterOutlet, toast_1.ToastComponent, plan_banner_1.PlanBanner],
            templateUrl: './panel.html',
            styleUrl: './panel.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _onEscape_decorators;
    var Panel = _classThis = class {
        constructor() {
            this.authService = (__runInitializers(this, _instanceExtraInitializers), (0, core_1.inject)(auth_service_1.AuthService));
            this.terminologyService = (0, core_1.inject)(terminology_service_1.TerminologyService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.statusService = (0, core_1.inject)(business_status_service_1.BusinessStatusService);
            this.sidebarOpen = (0, core_1.signal)(true);
            this.mobileSidebarOpen = (0, core_1.signal)(false);
            // En mobile el drawer siempre muestra labels, independiente de sidebarOpen
            this.showLabels = (0, core_1.computed)(() => this.sidebarOpen() || this.mobileSidebarOpen());
            this.isPro = (0, core_1.computed)(() => this.statusService.isPro());
            this.allNavItems = (0, core_1.computed)(() => [
                {
                    path: '/panel/dashboard',
                    label: 'Dashboard',
                    svgPath: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
                },
                {
                    path: '/panel/reservas',
                    label: this.terminologyService.reserva() + 's',
                    svgPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
                },
                {
                    path: '/panel/barberos',
                    label: this.terminologyService.profesionalPlural(),
                    svgPath: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z',
                },
                {
                    path: '/panel/servicios',
                    label: this.terminologyService.servicio() + 's',
                    svgPath: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
                },
                {
                    path: '/panel/horarios',
                    label: 'Horarios',
                    svgPath: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
                },
                {
                    path: '/panel/estadisticas',
                    label: 'Estadísticas',
                    svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z',
                    proOnly: true,
                },
                {
                    path: '/panel/configuracion',
                    label: 'Configuración',
                    svgPath: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
                },
            ]);
            this.navItems = (0, core_1.computed)(() => this.allNavItems().filter((item) => !item.proOnly || this.isPro()));
            this.availableBusinesses = (0, core_1.computed)(() => this.authService.availableBusinesses());
            this.currentBusiness = (0, core_1.computed)(() => this.authService.currentUser());
            this.hasMultipleBusinesses = (0, core_1.computed)(() => this.availableBusinesses().length > 1);
        }
        ngOnInit() {
            this.terminologyService.load().subscribe({
                error: () => this.toastService.warning('No se pudo cargar la configuración del panel.'),
            });
            this.statusService.load().subscribe();
        }
        // ── Sidebar desktop ───────────────────────────────────────────────────────
        toggleSidebar() {
            this.sidebarOpen.update((open) => !open);
        }
        // ── Sidebar mobile ────────────────────────────────────────────────────────
        openMobileSidebar() {
            this.mobileSidebarOpen.set(true);
            document.body.style.overflow = 'hidden';
        }
        closeMobileSidebar() {
            this.mobileSidebarOpen.set(false);
            document.body.style.overflow = '';
        }
        // Cerrar con tecla Escape
        onEscape() {
            if (this.mobileSidebarOpen())
                this.closeMobileSidebar();
        }
        // ── Acciones ──────────────────────────────────────────────────────────────
        logout() {
            this.authService.logout();
        }
        switchBusiness(businessId) {
            this.businessService.switchBusiness(businessId).subscribe({
                next: () => {
                    this.authService.me().subscribe({
                        next: () => window.location.reload(),
                    });
                },
                error: () => this.toastService.error('Error al cambiar de sucursal'),
            });
        }
    };
    __setFunctionName(_classThis, "Panel");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _onEscape_decorators = [(0, core_1.HostListener)('document:keydown.escape')];
        __esDecorate(_classThis, null, _onEscape_decorators, { kind: "method", name: "onEscape", static: false, private: false, access: { has: obj => "onEscape" in obj, get: obj => obj.onEscape }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Panel = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Panel = _classThis;
})();
exports.Panel = Panel;
//# sourceMappingURL=panel.js.map