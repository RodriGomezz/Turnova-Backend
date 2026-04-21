"use strict";
// src/app/features/panel/bookings/bookings.ts
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
exports.Bookings = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const common_1 = require("@angular/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const barber_service_1 = require("../../../core/services/barber.service");
const booking_service_1 = require("../../../core/services/booking.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
// ── Utils centralizadas ────────────────────────────────────────────────────
const date_utils_1 = require("../../../core/utils/date.utils");
// ── Helpers de calendario — extraídos del componente ──────────────────────
// Reemplaza las ~40 líneas de lógica inline del computed calendarDays
function buildBookingsCalendar(year, month, summary, selectedDate) {
    const today = (0, date_utils_1.todayString)();
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days = [];
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0)
        startDow = 6;
    // Días del mes anterior
    for (let i = startDow - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, -i);
        days.push({
            date: (0, date_utils_1.toDateString)(d),
            day: d.getDate(),
            isCurrentMonth: false,
            isToday: false,
            isSelected: false,
            total: 0,
        });
    }
    // Días del mes actual
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        days.push({
            date: dateStr,
            day: d,
            isCurrentMonth: true,
            isToday: dateStr === today,
            isSelected: dateStr === selectedDate,
            total: summary.find((s) => s.fecha === dateStr)?.total ?? 0,
        });
    }
    // Días del mes siguiente hasta completar 42 celdas
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month, d);
        days.push({
            date: (0, date_utils_1.toDateString)(date),
            day: d,
            isCurrentMonth: false,
            isToday: false,
            isSelected: false,
            total: 0,
        });
    }
    return days;
}
// ── Componente ─────────────────────────────────────────────────────────────
let Bookings = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-bookings',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.TitleCasePipe, common_1.LowerCasePipe],
            templateUrl: './bookings.html',
            styleUrl: './bookings.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Bookings = _classThis = class {
        constructor() {
            // ── Dependencias ──────────────────────────────────────────────────────────
            this.bookingService = (0, core_1.inject)(booking_service_1.BookingService);
            this.barberService = (0, core_1.inject)(barber_service_1.BarberService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terms = (0, core_1.inject)(terminology_service_1.TerminologyService);
            // ── Estado ────────────────────────────────────────────────────────────────
            this.bookings = (0, core_1.signal)([]);
            this.barbers = (0, core_1.signal)([]);
            this.monthSummary = (0, core_1.signal)([]);
            this.loading = (0, core_1.signal)(true);
            this.loadingMonth = (0, core_1.signal)(false);
            this.filterEstado = (0, core_1.signal)('todos');
            this.search = (0, core_1.signal)('');
            this.selectedFecha = (0, core_1.signal)((0, date_utils_1.todayString)());
            this.currentYear = (0, core_1.signal)(new Date().getFullYear());
            this.currentMonth = (0, core_1.signal)(new Date().getMonth() + 1);
            // ── Constantes de UI ─────────────────────────────────────────────────────
            this.MESES = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
            ];
            this.DIAS_HEADER = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
            // ── Computeds ─────────────────────────────────────────────────────────────
            this.filtered = (0, core_1.computed)(() => {
                let list = this.bookings();
                if (this.filterEstado() !== 'todos') {
                    list = list.filter((b) => b.estado === this.filterEstado());
                }
                const q = this.search().toLowerCase().trim();
                if (q) {
                    list = list.filter((b) => b.cliente_nombre.toLowerCase().includes(q) ||
                        b.cliente_email.toLowerCase().includes(q) ||
                        b.cliente_telefono.includes(q));
                }
                return list;
            });
            // calendarDays delega en la función pura buildBookingsCalendar
            // — testeable de forma aislada sin instanciar el componente
            this.calendarDays = (0, core_1.computed)(() => buildBookingsCalendar(this.currentYear(), this.currentMonth(), this.monthSummary(), this.selectedFecha()));
            this.totalPendientes = (0, core_1.computed)(() => this.bookings().filter((b) => b.estado === 'pendiente').length);
            this.totalConfirmadas = (0, core_1.computed)(() => this.bookings().filter((b) => b.estado === 'confirmada').length);
        }
        // ── Lifecycle ─────────────────────────────────────────────────────────────
        ngOnInit() {
            this.loadInitial();
        }
        // ── Carga de datos ────────────────────────────────────────────────────────
        loadInitial() {
            this.loading.set(true);
            (0, rxjs_1.forkJoin)({
                barbers: this.barberService.list(),
                bookings: this.bookingService.getByDate(this.selectedFecha()),
                month: this.bookingService.getMonthSummary(this.currentYear(), this.currentMonth()),
            })
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: ({ barbers, bookings, month }) => {
                    this.barbers.set(barbers);
                    this.bookings.set(bookings);
                    this.monthSummary.set(month.summary);
                },
                error: () => this.toastService.error('Error al cargar los turnos'),
            });
        }
        loadMonth() {
            this.loadingMonth.set(true);
            this.bookingService
                .getMonthSummary(this.currentYear(), this.currentMonth())
                .pipe((0, operators_1.finalize)(() => this.loadingMonth.set(false)))
                .subscribe({
                next: (res) => this.monthSummary.set(res.summary),
                error: () => this.toastService.error('Error al cargar el resumen del mes'),
            });
        }
        loadBookings() {
            this.loading.set(true);
            this.bookingService
                .getByDate(this.selectedFecha())
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: (bookings) => this.bookings.set(bookings),
                error: () => this.toastService.error('Error al cargar los turnos del día'),
            });
        }
        // ── Navegación de calendario ──────────────────────────────────────────────
        prevMonth() {
            if (this.currentMonth() === 1) {
                this.currentMonth.set(12);
                this.currentYear.set(this.currentYear() - 1);
            }
            else {
                this.currentMonth.set(this.currentMonth() - 1);
            }
            this.loadMonth();
        }
        nextMonth() {
            if (this.currentMonth() === 12) {
                this.currentMonth.set(1);
                this.currentYear.set(this.currentYear() + 1);
            }
            else {
                this.currentMonth.set(this.currentMonth() + 1);
            }
            this.loadMonth();
        }
        goToday() {
            const now = new Date();
            this.currentYear.set(now.getFullYear());
            this.currentMonth.set(now.getMonth() + 1);
            this.selectedFecha.set((0, date_utils_1.todayString)());
            this.loadMonth();
            this.loadBookings();
        }
        selectDay(day) {
            if (!day.isCurrentMonth)
                return;
            this.selectedFecha.set(day.date);
            this.loadBookings();
        }
        // ── Acciones ──────────────────────────────────────────────────────────────
        updateEstado(id, estado) {
            this.bookingService.updateEstado(id, estado).subscribe({
                next: () => {
                    this.loadBookings();
                    this.toastService.success(estado === 'confirmada' ? 'Turno confirmado' : 'Turno cancelado');
                },
                error: () => this.toastService.error('Error al actualizar el turno'),
            });
        }
        // ── Handlers de formulario ────────────────────────────────────────────────
        onSearchInput(event) {
            this.search.set(event.target.value);
        }
        onFilterChange(event) {
            this.filterEstado.set(event.target.value);
        }
        // ── Helpers de template ───────────────────────────────────────────────────
        getBarberNombre(barberId) {
            return this.barbers().find((b) => b.id === barberId)?.nombre ?? '—';
        }
        getServiceNombre(booking) {
            return booking.services?.nombre ?? 'Servicio';
        }
        formatFecha(fecha) {
            return (0, date_utils_1.formatFechaUY)(fecha);
        }
        isToday(fecha) {
            return fecha === (0, date_utils_1.todayString)();
        }
    };
    __setFunctionName(_classThis, "Bookings");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Bookings = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Bookings = _classThis;
})();
exports.Bookings = Bookings;
//# sourceMappingURL=bookings.js.map