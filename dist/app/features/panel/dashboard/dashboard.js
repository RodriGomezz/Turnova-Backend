"use strict";
// src/app/features/panel/dashboard/dashboard.ts
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
exports.Dashboard = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const router_1 = require("@angular/router");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const booking_service_1 = require("../../../core/services/booking.service");
const business_service_1 = require("../../../core/services/business.service");
const business_status_service_1 = require("../../../core/services/business-status.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
const onboarding_1 = require("../onboarding/onboarding");
// ── Utils centralizadas — eliminan duplicación entre componentes ───────────
const date_utils_1 = require("../../../core/utils/date.utils");
// ── Constantes de color de ocupación ─────────────────────────────────────
const OCUPACION_LEVELS = [
    { min: 85, label: 'Día lleno', color: '#22C55E' },
    { min: 60, label: 'Buen ritmo', color: '#C9A84C' },
    { min: 30, label: 'Ritmo moderado', color: '#3B82F6' },
    { min: 0, label: 'Día tranquilo', color: '#9CA3AF' },
];
let Dashboard = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-dashboard',
            standalone: true,
            imports: [common_1.TitleCasePipe, common_1.LowerCasePipe, router_1.RouterLink, onboarding_1.Onboarding],
            templateUrl: './dashboard.html',
            styleUrl: './dashboard.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Dashboard = _classThis = class {
        constructor() {
            // ── Dependencias ─────────────────────────────────────────────────────────
            this.bookingService = (0, core_1.inject)(booking_service_1.BookingService);
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.statusService = (0, core_1.inject)(business_status_service_1.BusinessStatusService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terms = (0, core_1.inject)(terminology_service_1.TerminologyService);
            // ── Estado ───────────────────────────────────────────────────────────────
            this.loading = (0, core_1.signal)(true);
            this.bookings = (0, core_1.signal)([]);
            this.daySummary = (0, core_1.signal)(null);
            this.autoConfirmar = (0, core_1.signal)(false);
            this.excedeLimit = (0, core_1.signal)(false);
            this.maxBarberos = (0, core_1.signal)(1);
            this.selectedFecha = (0, core_1.signal)((0, date_utils_1.todayString)());
            this.showOnboarding = (0, core_1.signal)(false);
            // isPro y trialDaysLeft vienen del servicio central que consolida
            // business.plan + subscription.status — evita mostrar "trial vencido"
            // a usuarios con suscripción activa.
            this.isPro = (0, core_1.computed)(() => this.statusService.isPro());
            this.trialDaysLeft = (0, core_1.computed)(() => this.statusService.trialDaysLeft());
            this.business = (0, core_1.signal)(null);
            // ── Computeds ─────────────────────────────────────────────────────────────
            this.resumen = (0, core_1.computed)(() => this.daySummary()?.resumen ?? null);
            this.barbersSummary = (0, core_1.computed)(() => (this.daySummary()?.barbers ?? []).filter((b) => b.trabajaHoy));
            this.businessSlug = (0, core_1.computed)(() => this.business()?.slug ?? '');
            /**
             * Primera reserva pendiente o confirmada que aún no comenzó.
             * Solo relevante cuando selectedFecha es hoy.
             */
            this.proximaReserva = (0, core_1.computed)(() => {
                if (!this.isToday())
                    return null;
                const horaActual = (0, date_utils_1.currentTimeString)();
                return (this.bookings()
                    .filter((b) => b.estado !== 'cancelada' && b.hora_inicio >= horaActual)
                    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0] ?? null);
            });
        }
        // ── Lifecycle ─────────────────────────────────────────────────────────────
        ngOnInit() {
            this.loadData();
        }
        // ── Carga de datos ────────────────────────────────────────────────────────
        loadData() {
            this.loading.set(true);
            (0, rxjs_1.forkJoin)({
                bookings: this.bookingService.getByDate(this.selectedFecha()),
                summary: this.bookingService.getDaySummary(this.selectedFecha()),
                business: this.businessService.get(),
                status: this.businessService.getStatus(),
            })
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: ({ bookings, summary, business, status }) => {
                    this.bookings.set(bookings);
                    this.daySummary.set(summary);
                    this.business.set(business);
                    this.autoConfirmar.set(business.auto_confirmar);
                    this.excedeLimit.set(status.excedeLimit);
                    this.maxBarberos.set(status.maxBarberos);
                    if (!business.onboarding_completed) {
                        this.showOnboarding.set(true);
                    }
                },
                error: () => this.toastService.error('Error al cargar el dashboard'),
            });
        }
        // ── Onboarding ────────────────────────────────────────────────────────────
        onOnboardingCompleted() {
            this.showOnboarding.set(false);
            this.loadData();
        }
        onOnboardingSkipped() {
            this.showOnboarding.set(false);
        }
        // ── Navegación de fechas ──────────────────────────────────────────────────
        changeDate(offset) {
            const date = new Date(`${this.selectedFecha()}T00:00:00`);
            date.setDate(date.getDate() + offset);
            this.selectedFecha.set((0, date_utils_1.toDateString)(date));
            this.loadData();
        }
        goToToday() {
            this.selectedFecha.set((0, date_utils_1.todayString)());
            this.loadData();
        }
        // ── Acciones ─────────────────────────────────────────────────────────────
        updateEstado(id, estado) {
            this.bookingService.updateEstado(id, estado).subscribe({
                next: () => {
                    this.loadData();
                    this.toastService.success(estado === 'confirmada' ? 'Turno confirmado' : 'Turno cancelado');
                },
                error: () => this.toastService.error('Error al actualizar el turno'),
            });
        }
        copyPublicLink() {
            const slug = this.businessSlug();
            if (!slug)
                return;
            const url = window.location.hostname === 'localhost' ||
                window.location.hostname.endsWith('.localhost')
                ? `http://${slug}.localhost:4200`
                : `https://${slug}.turnio.pro`;
            navigator.clipboard.writeText(url);
            this.toastService.success('Link copiado');
        }
        // ── Helpers de template ───────────────────────────────────────────────────
        isToday() {
            return this.selectedFecha() === (0, date_utils_1.todayString)();
        }
        isPast(booking) {
            if (!this.isToday())
                return false;
            return booking.hora_fin.slice(0, 5) < (0, date_utils_1.currentTimeString)();
        }
        getBarberNombre(barberId) {
            return ((this.daySummary()?.barbers ?? []).find((b) => b.id === barberId)?.nombre ?? '—');
        }
        getServiceNombre(booking) {
            return booking.services?.nombre ?? 'Servicio';
        }
        formatFecha(fecha) {
            return (0, date_utils_1.formatFechaUY)(fecha);
        }
        getOcupacionLabel(pct) {
            return (OCUPACION_LEVELS.find((l) => pct >= l.min)?.label ?? 'Día tranquilo');
        }
        getOcupacionColor(pct) {
            return (OCUPACION_LEVELS.find((l) => pct >= l.min)?.color ?? '#9CA3AF');
        }
    };
    __setFunctionName(_classThis, "Dashboard");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Dashboard = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Dashboard = _classThis;
})();
exports.Dashboard = Dashboard;
//# sourceMappingURL=dashboard.js.map