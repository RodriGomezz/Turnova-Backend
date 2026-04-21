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
exports.Booking = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const forms_1 = require("@angular/forms");
const common_1 = require("@angular/common");
const public_service_1 = require("../../../core/services/public.service");
const subdomain_service_1 = require("../../../core/services/subdomain.service");
const color_utils_1 = require("../../../core/utils/color.utils");
let Booking = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-booking',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.TitleCasePipe],
            templateUrl: './booking.html',
            styleUrl: './booking.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Booking = _classThis = class {
        constructor() {
            this.route = (0, core_1.inject)(router_1.ActivatedRoute);
            this.router = (0, core_1.inject)(router_1.Router);
            this.publicService = (0, core_1.inject)(public_service_1.PublicService);
            this.subdomainService = (0, core_1.inject)(subdomain_service_1.SubdomainService);
            this.slug = (0, core_1.signal)('');
            this.step = (0, core_1.signal)(1);
            this.loading = (0, core_1.signal)(true);
            this.saving = (0, core_1.signal)(false);
            this.error = (0, core_1.signal)(null);
            this.singleBarber = (0, core_1.signal)(false);
            this.loadingSlots = (0, core_1.signal)(false);
            this.loadingDays = (0, core_1.signal)(false);
            this.barbers = (0, core_1.signal)([]);
            this.services = (0, core_1.signal)([]);
            this.slots = (0, core_1.signal)([]);
            this.selectedBarber = (0, core_1.signal)(null);
            this.selectedService = (0, core_1.signal)(null);
            this.selectedFecha = (0, core_1.signal)('');
            this.selectedSlot = (0, core_1.signal)(null);
            this.business = (0, core_1.signal)(null);
            this.calendarYear = (0, core_1.signal)(new Date().getFullYear());
            this.calendarMonth = (0, core_1.signal)(new Date().getMonth() + 1);
            this.availableDays = (0, core_1.signal)([]);
            this.DIAS_HEADER = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
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
            this.clienteForm = { nombre: '', email: '', telefono: '09' };
            this.minFecha = this.dateToString(new Date());
            // ── Computeds ─────────────────────────────────────────────────────────────
            this.totalSteps = (0, core_1.computed)(() => (this.singleBarber() ? 3 : 4));
            this.visualStep = (0, core_1.computed)(() => {
                const s = this.step();
                if (!this.singleBarber())
                    return s;
                if (s === 1)
                    return 1;
                if (s === 3)
                    return 2;
                if (s === 4)
                    return 3;
                return s;
            });
            this.stepLabel = (0, core_1.computed)(() => {
                const s = this.step();
                const b = this.business();
                const srv = b?.termino_servicio?.toLowerCase() ?? 'servicio';
                const pro = b?.termino_profesional?.toLowerCase() ?? 'profesional';
                const res = b?.termino_reserva?.toLowerCase() ?? 'turno';
                if (s === 1)
                    return `¿Qué ${srv} desea?`;
                if (s === 2 && !this.singleBarber())
                    return `¿Con qué ${pro} desea atenderse?`;
                if (s === 2 && this.singleBarber())
                    return `¿Cuándo desea su ${res}?`;
                if (s === 3)
                    return this.singleBarber() ? 'Sus datos' : `¿Cuándo desea su ${res}?`;
                return 'Sus datos';
            });
            this.confirmarLink = (0, core_1.computed)(() => this.subdomainService.buildRouterLink(this.slug(), 'confirmar'));
            this.calendarDays = (0, core_1.computed)(() => {
                const year = this.calendarYear();
                const month = this.calendarMonth();
                const available = this.availableDays();
                const todayStr = this.dateToString(new Date());
                const firstDay = new Date(year, month - 1, 1);
                const lastDay = new Date(year, month, 0);
                let startDow = firstDay.getDay() - 1;
                if (startDow < 0)
                    startDow = 6;
                const days = [];
                for (let i = startDow - 1; i >= 0; i--) {
                    const d = new Date(year, month - 1, -i);
                    days.push({
                        date: this.dateToString(d),
                        day: d.getDate(),
                        currentMonth: false,
                        available: false,
                        isToday: false,
                    });
                }
                for (let d = 1; d <= lastDay.getDate(); d++) {
                    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                    days.push({
                        date: dateStr,
                        day: d,
                        currentMonth: true,
                        available: available.includes(dateStr),
                        isToday: dateStr === todayStr,
                        isPast: dateStr < todayStr,
                    });
                }
                const remaining = 42 - days.length;
                for (let d = 1; d <= remaining; d++) {
                    const date = new Date(year, month, d);
                    days.push({
                        date: this.dateToString(date),
                        day: d,
                        currentMonth: false,
                        available: false,
                        isToday: false,
                    });
                }
                return days;
            });
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            const slug = this.subdomainService.getSlug() ??
                this.route.snapshot.paramMap.get('slug') ??
                '';
            this.slug.set(slug);
            const preselectedServiceId = this.route.snapshot.queryParamMap.get('service_id');
            this.publicService.getBusiness(slug).subscribe({
                next: (res) => {
                    this.business.set(res.business);
                    this.barbers.set(res.barbers);
                    this.services.set(res.services);
                    if (res.barbers.length === 1) {
                        this.selectedBarber.set(res.barbers[0]);
                        this.singleBarber.set(true);
                    }
                    if (preselectedServiceId) {
                        const service = res.services.find((s) => s.id === preselectedServiceId);
                        if (service)
                            this.selectService(service);
                    }
                    this.loading.set(false);
                },
                error: () => {
                    this.error.set('No se pudo cargar el negocio');
                    this.loading.set(false);
                },
            });
        }
        // ── Steps ──────────────────────────────────────────────────────────────────
        selectService(service) {
            this.selectedService.set(service);
            if (this.singleBarber()) {
                this.resetCalendar();
                this.loadAvailableDays();
            }
            this.step.set(this.singleBarber() ? 3 : 2);
        }
        selectBarber(barber) {
            this.selectedBarber.set(barber);
            this.slots.set([]);
            this.selectedSlot.set(null);
            this.selectedFecha.set('');
            this.resetCalendar();
            this.loadAvailableDays();
            this.step.set(3);
        }
        selectSlot(slot) {
            this.selectedSlot.set(slot);
            this.step.set(4);
        }
        goToStep(target) {
            if (target >= this.step())
                return;
            if (target <= 1) {
                this.selectedService.set(null);
                this.selectedFecha.set('');
                this.selectedSlot.set(null);
                this.slots.set([]);
            }
            if (target <= 2) {
                this.selectedFecha.set('');
                this.selectedSlot.set(null);
                this.slots.set([]);
            }
            if (target <= 3) {
                this.selectedSlot.set(null);
            }
            this.step.set(target);
            this.error.set(null);
        }
        back() {
            const s = this.step();
            this.error.set(null);
            if (s === 1) {
                this.router.navigate(this.subdomainService.buildRouterLink(this.slug()));
                return;
            }
            if (s === 2) {
                this.step.set(1);
                return;
            }
            if (s === 3) {
                this.step.set(this.singleBarber() ? 1 : 2);
                return;
            }
            if (s === 4) {
                this.step.set(3);
                return;
            }
        }
        // ── Confirm ────────────────────────────────────────────────────────────────
        confirm() {
            if (!this.clienteForm.nombre.trim()) {
                this.error.set('El nombre es requerido');
                return;
            }
            if (!this.clienteForm.email.trim()) {
                this.error.set('El email es requerido');
                return;
            }
            if (!this.clienteForm.telefono.trim() ||
                this.clienteForm.telefono === '09') {
                this.error.set('El teléfono es requerido');
                return;
            }
            const barber = this.selectedBarber();
            const service = this.selectedService();
            const slot = this.selectedSlot();
            this.saving.set(true);
            this.error.set(null);
            this.publicService
                .createBooking(this.slug(), {
                barber_id: barber.id,
                service_id: service.id,
                fecha: this.selectedFecha(),
                hora_inicio: slot.hora_inicio,
                hora_fin: slot.hora_fin,
                cliente_nombre: this.clienteForm.nombre,
                cliente_email: this.clienteForm.email,
                cliente_telefono: this.clienteForm.telefono,
            })
                .subscribe({
                next: (res) => {
                    // Solo datos no sensibles en query params — el email NO viaja en URL.
                    // El componente confirm carga el negocio por slug directamente.
                    this.router.navigate(this.subdomainService.buildRouterLink(this.slug(), 'confirmar'), {
                        queryParams: {
                            nombre: this.clienteForm.nombre,
                            fecha: this.selectedFecha(),
                            hora: slot.hora_inicio.slice(0, 5),
                            servicio: service.nombre,
                            barbero: barber.nombre,
                            estado: res.estado,
                        },
                    });
                },
                error: (err) => {
                    this.saving.set(false);
                    this.error.set(err.error?.error ?? 'No se pudo crear el turno');
                },
            });
        }
        // ── Calendar ───────────────────────────────────────────────────────────────
        loadAvailableDays() {
            const barber = this.selectedBarber();
            const service = this.selectedService();
            if (!barber || !service)
                return;
            this.loadingDays.set(true);
            this.publicService
                .getAvailableDays(this.slug(), barber.id, this.calendarYear(), this.calendarMonth(), service.id)
                .subscribe({
                next: (res) => {
                    this.availableDays.set(res.availableDays);
                    this.loadingDays.set(false);
                },
                error: () => this.loadingDays.set(false),
            });
        }
        prevMonth() {
            if (this.calendarMonth() === 1) {
                this.calendarMonth.set(12);
                this.calendarYear.set(this.calendarYear() - 1);
            }
            else {
                this.calendarMonth.set(this.calendarMonth() - 1);
            }
            this.clearDateSelection();
            this.loadAvailableDays();
        }
        nextMonth() {
            if (this.calendarMonth() === 12) {
                this.calendarMonth.set(1);
                this.calendarYear.set(this.calendarYear() + 1);
            }
            else {
                this.calendarMonth.set(this.calendarMonth() + 1);
            }
            this.clearDateSelection();
            this.loadAvailableDays();
        }
        onFechaSelected(date) {
            this.selectedFecha.set(date);
            this.onFechaChange();
        }
        onFechaChange() {
            this.selectedSlot.set(null);
            this.slots.set([]);
            const barber = this.selectedBarber();
            const service = this.selectedService();
            const fecha = this.selectedFecha();
            if (!barber || !service || !fecha)
                return;
            this.loadingSlots.set(true);
            this.publicService
                .getSlots(this.slug(), barber.id, fecha, service.id)
                .subscribe({
                next: (res) => {
                    const todayStr = this.dateToString(new Date());
                    const now = new Date();
                    const horaActual = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    this.slots.set(res.slots.filter((s) => {
                        if (!s.disponible)
                            return false;
                        if (fecha === todayStr && s.hora_inicio <= horaActual)
                            return false;
                        return true;
                    }));
                    this.loadingSlots.set(false);
                },
                error: () => {
                    this.slots.set([]);
                    this.loadingSlots.set(false);
                },
            });
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        esOscuro(hex) {
            return (0, color_utils_1.esOscuro)(hex);
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
        formatPrecio(service) {
            const base = `$${service.precio.toLocaleString('es-UY')}`;
            return service.precio_hasta
                ? `${base} – $${service.precio_hasta.toLocaleString('es-UY')}`
                : base;
        }
        dateToString(date) {
            const y = date.getFullYear();
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        resetCalendar() {
            this.calendarYear.set(new Date().getFullYear());
            this.calendarMonth.set(new Date().getMonth() + 1);
        }
        clearDateSelection() {
            this.selectedFecha.set('');
            this.selectedSlot.set(null);
            this.slots.set([]);
        }
    };
    __setFunctionName(_classThis, "Booking");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Booking = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Booking = _classThis;
})();
exports.Booking = Booking;
//# sourceMappingURL=booking.js.map