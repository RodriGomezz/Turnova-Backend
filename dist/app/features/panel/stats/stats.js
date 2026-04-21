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
exports.Stats = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const operators_1 = require("rxjs/operators");
const stats_service_1 = require("../../../core/services/stats.service");
const barber_service_1 = require("../../../core/services/barber.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
let Stats = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-stats',
            standalone: true,
            imports: [common_1.LowerCasePipe, common_1.TitleCasePipe],
            templateUrl: './stats.html',
            styleUrl: './stats.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Stats = _classThis = class {
        constructor() {
            this.statsService = (0, core_1.inject)(stats_service_1.StatsService);
            this.barberService = (0, core_1.inject)(barber_service_1.BarberService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terms = (0, core_1.inject)(terminology_service_1.TerminologyService);
            this.loading = (0, core_1.signal)(true);
            this.stats = (0, core_1.signal)(null);
            this.barbers = (0, core_1.signal)([]);
            this.statsYear = (0, core_1.signal)(new Date().getFullYear());
            this.statsMonth = (0, core_1.signal)(new Date().getMonth() + 1);
            this.MESES = [
                'Enero',
                'Febrero',
                'Marzo',
                'Abril',
                'Mayo',
                'Junio',
                'Julio',
                'Agosto',
                'Septiembre',
                'Octubre',
                'Noviembre',
                'Diciembre',
            ];
            // ── Computeds ─────────────────────────────────────────────────────────────
            this.mesLabel = (0, core_1.computed)(() => `${this.MESES[this.statsMonth() - 1]} ${this.statsYear()}`);
            this.topProfesionalNombre = (0, core_1.computed)(() => {
                const id = this.stats()?.topProfesionalId;
                if (!id)
                    return null;
                return this.barbers().find((b) => b.id === id)?.nombre ?? null;
            });
            this.isCurrentMonth = (0, core_1.computed)(() => {
                const now = new Date();
                return (this.statsYear() === now.getFullYear() &&
                    this.statsMonth() === now.getMonth() + 1);
            });
            this.maxDayCount = (0, core_1.computed)(() => {
                const porDia = this.stats()?.porDia ?? [];
                return Math.max(...porDia.map((d) => d.total), 1);
            });
            this.maxHoraCount = (0, core_1.computed)(() => {
                const horas = this.stats()?.distribucionHoras ?? [];
                return Math.max(...horas.map((h) => h.count), 1);
            });
            this.mejorDia = (0, core_1.computed)(() => {
                const porDia = this.stats()?.porDia ?? [];
                if (!porDia.length)
                    return null;
                const mejor = porDia.reduce((max, d) => (d.total > max.total ? d : max), {
                    fecha: '',
                    total: 0,
                });
                return mejor.total > 0 ? mejor : null;
            });
            this.promedioTurnosDia = (0, core_1.computed)(() => {
                const porDia = this.stats()?.porDia ?? [];
                const diasConTurnos = porDia.filter((d) => d.total > 0);
                if (!diasConTurnos.length)
                    return 0;
                const total = diasConTurnos.reduce((sum, d) => sum + d.total, 0);
                return Math.round((total / diasConTurnos.length) * 10) / 10;
            });
            this.ingresoPromedioPorTurno = (0, core_1.computed)(() => {
                const r = this.stats()?.resumen;
                if (!r || !r.totalTurnos)
                    return 0;
                return Math.round(r.ingresosMes / r.totalTurnos);
            });
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            this.barberService.list().subscribe({
                next: (barbers) => this.barbers.set(barbers),
            });
            this.loadStats();
        }
        // ── Data ───────────────────────────────────────────────────────────────────
        loadStats() {
            this.loading.set(true);
            this.statsService
                .get(this.statsYear(), this.statsMonth())
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: (stats) => this.stats.set(stats),
                error: () => this.toastService.error('Error al cargar las estadísticas'),
            });
        }
        prevMes() {
            if (this.statsMonth() === 1) {
                this.statsMonth.set(12);
                this.statsYear.set(this.statsYear() - 1);
            }
            else {
                this.statsMonth.set(this.statsMonth() - 1);
            }
            this.loadStats();
        }
        nextMes() {
            if (this.isCurrentMonth())
                return;
            if (this.statsMonth() === 12) {
                this.statsMonth.set(1);
                this.statsYear.set(this.statsYear() + 1);
            }
            else {
                this.statsMonth.set(this.statsMonth() + 1);
            }
            this.loadStats();
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        formatVariacion(v) {
            if (v === null)
                return 'Sin datos del mes anterior';
            if (v === 0)
                return 'Igual que el mes anterior';
            return v > 0 ? `+${v}% vs mes anterior` : `${v}% vs mes anterior`;
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
        getDayBarHeight(total) {
            return Math.round((total / this.maxDayCount()) * 100);
        }
        getHoraBarHeight(count) {
            return Math.round((count / this.maxHoraCount()) * 100);
        }
        getPorDiaLast15() {
            const porDia = this.stats()?.porDia ?? [];
            return porDia.slice(-15).map((d) => ({
                ...d,
                day: parseInt(d.fecha.split('-')[2]),
            }));
        }
        get tasaRetencion() {
            const r = this.stats()?.resumen;
            if (!r)
                return 0;
            const total = r.clientesNuevos + r.clientesRecurrentes;
            if (total === 0)
                return 0;
            return Math.round((r.clientesRecurrentes / total) * 100);
        }
    };
    __setFunctionName(_classThis, "Stats");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Stats = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Stats = _classThis;
})();
exports.Stats = Stats;
//# sourceMappingURL=stats.js.map