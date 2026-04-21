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
exports.Onboarding = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const common_1 = require("@angular/common");
const barber_service_1 = require("../../../core/services/barber.service");
const service_service_1 = require("../../../core/services/service.service");
const schedule_service_1 = require("../../../core/services/schedule.service");
const business_service_1 = require("../../../core/services/business.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
const tipo_negocio_1 = require("../../../core/models/tipo-negocio");
const color_utils_1 = require("../../../core/utils/color.utils");
const DIAS_SEMANA = [
    { dia: 1, label: 'Lunes' },
    { dia: 2, label: 'Martes' },
    { dia: 3, label: 'Miércoles' },
    { dia: 4, label: 'Jueves' },
    { dia: 5, label: 'Viernes' },
    { dia: 6, label: 'Sábado' },
    { dia: 0, label: 'Domingo' },
];
let Onboarding = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-onboarding',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.LowerCasePipe],
            templateUrl: './onboarding.html',
            styleUrl: './onboarding.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Onboarding = _classThis = class {
        constructor() {
            this.barberService = (0, core_1.inject)(barber_service_1.BarberService);
            this.serviceService = (0, core_1.inject)(service_service_1.ServiceService);
            this.scheduleService = (0, core_1.inject)(schedule_service_1.ScheduleService);
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terms = (0, core_1.inject)(terminology_service_1.TerminologyService);
            this.completed = (0, core_1.output)();
            this.skipped = (0, core_1.output)();
            this.step = (0, core_1.signal)(1);
            this.saving = (0, core_1.signal)(false);
            this.tipoNegocio = 'otro';
            // ── Step 1 — Profesional ───────────────────────────────────────────────────
            this.profesionalNombre = (0, core_1.signal)('');
            this.profesionalDescripcion = (0, core_1.signal)('');
            // ── Step 2 — Servicio ──────────────────────────────────────────────────────
            this.servicioNombre = (0, core_1.signal)('');
            this.servicioDuracion = (0, core_1.signal)(30);
            this.servicioPrecio = (0, core_1.signal)(0);
            this.defaults = (0, core_1.signal)([]);
            this.showDefaults = (0, core_1.signal)(false);
            // ── Step 3 — Horarios ──────────────────────────────────────────────────────
            this.diasHorario = (0, core_1.signal)(DIAS_SEMANA.map((d) => ({
                dia: d.dia,
                label: d.label,
                activo: d.dia >= 1 && d.dia <= 6, // Lunes a sábado por defecto
                hora_inicio: '09:00',
                hora_fin: '19:00',
            })));
            // ── Step 4 — Colores ───────────────────────────────────────────────────────
            this.colorFondo = (0, core_1.signal)('#0A0A0A');
            this.colorAcento = (0, core_1.signal)('#C9A84C');
            this.paletas = [
                { nombre: 'Carbón + Oro', fondo: '#0A0A0A', acento: '#C9A84C' },
                { nombre: 'Medianoche + Marfil', fondo: '#1A1A2E', acento: '#E8D5B7' },
                { nombre: 'Hielo + Marino', fondo: '#F0F4FF', acento: '#1A3A6B' },
                { nombre: 'Blanco + Negro', fondo: '#F5F5F5', acento: '#111111' },
                { nombre: 'Menta + Bosque', fondo: '#F0FBF4', acento: '#1A4731' },
                { nombre: 'Crema + Terracota', fondo: '#FFF8F0', acento: '#B8431A' },
                { nombre: 'Pitch + Verde', fondo: '#0D0D0D', acento: '#00A374' },
                { nombre: 'Índigo + Violeta', fondo: '#1C1C3A', acento: '#B065FF' },
                { nombre: 'Rosa + Fucsia', fondo: '#FDF0F5', acento: '#C2366B' },
            ];
            this.totalSteps = 5;
            this.progressPct = (0, core_1.computed)(() => Math.round(((this.step() - 1) / this.totalSteps) * 100));
            // Obtener tipo de negocio del business actual
            this.businessService.get().subscribe({
                next: (business) => {
                    this.tipoNegocio = business.tipo_negocio ?? 'otro';
                    this.colorFondo.set(business.color_fondo ?? '#0A0A0A');
                    this.colorAcento.set(business.color_acento ?? '#C9A84C');
                    this.loadDefaults();
                },
            });
        }
        // ── Data ───────────────────────────────────────────────────────────────────
        loadDefaults() {
            this.serviceService.listDefaults(this.tipoNegocio).subscribe({
                next: (defaults) => this.defaults.set(defaults),
            });
        }
        // ── Navigation ─────────────────────────────────────────────────────────────
        next() {
            const current = this.step();
            if (current === 1 && !this.validateStep1())
                return;
            if (current === 2 && !this.validateStep2())
                return;
            if (current < this.totalSteps) {
                this.step.set((current + 1));
            }
        }
        back() {
            const current = this.step();
            if (current > 1)
                this.step.set((current - 1));
        }
        skip() {
            this.businessService.completeOnboarding().subscribe();
            this.skipped.emit();
        }
        // ── Validation ─────────────────────────────────────────────────────────────
        validateStep1() {
            if (!this.profesionalNombre().trim()) {
                this.toastService.error(`El nombre del ${this.terms.profesional().toLowerCase()} es requerido`);
                return false;
            }
            return true;
        }
        validateStep2() {
            if (!this.servicioNombre().trim()) {
                this.toastService.error(`El nombre del ${this.terms.servicio().toLowerCase()} es requerido`);
                return false;
            }
            if (this.servicioPrecio() < 0) {
                this.toastService.error('El precio no puede ser negativo');
                return false;
            }
            return true;
        }
        // ── Actions ────────────────────────────────────────────────────────────────
        useDefault(def) {
            this.servicioNombre.set(def.nombre);
            this.servicioDuracion.set(def.duracion_minutos);
            this.servicioPrecio.set(def.precio_sugerido);
            this.showDefaults.set(false);
        }
        selectPaleta(paleta) {
            this.colorFondo.set(paleta.fondo);
            this.colorAcento.set(paleta.acento);
        }
        finish() {
            this.saving.set(true);
            const diasActivos = this.diasHorario().filter((d) => d.activo);
            // Crear todo en paralelo
            Promise.all([
                // Profesional
                this.barberService
                    .create({
                    nombre: this.profesionalNombre().trim(),
                    descripcion: this.profesionalDescripcion().trim() || undefined,
                })
                    .toPromise(),
                // Servicio
                this.serviceService
                    .create({
                    nombre: this.servicioNombre().trim(),
                    duracion_minutos: this.servicioDuracion(),
                    precio: this.servicioPrecio(),
                })
                    .toPromise(),
                // Horarios
                ...diasActivos.map((d) => this.scheduleService
                    .createSchedule({
                    dia_semana: d.dia,
                    hora_inicio: d.hora_inicio,
                    hora_fin: d.hora_fin,
                })
                    .toPromise()),
                // Colores
                this.businessService
                    .update({
                    color_fondo: this.colorFondo(),
                    color_acento: this.colorAcento(),
                    color_superficie: (0, color_utils_1.esOscuro)(this.colorFondo()) ? '#1C1C1E' : '#FFFFFF',
                })
                    .toPromise(),
                // Marcar onboarding completo
                this.businessService.completeOnboarding().toPromise(),
            ])
                .then(() => {
                this.saving.set(false);
                this.completed.emit();
            })
                .catch(() => {
                this.saving.set(false);
                this.toastService.error('Error al guardar. Intentá de nuevo.');
            });
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        toggleDia(dia) {
            this.diasHorario.update((dias) => dias.map((d) => (d.dia === dia.dia ? { ...d, activo: !d.activo } : d)));
        }
        setHorario(dia, field, value) {
            this.diasHorario.update((dias) => dias.map((d) => (d.dia === dia ? { ...d, [field]: value } : d)));
        }
        esOscuro(hex) {
            return (0, color_utils_1.esOscuro)(hex);
        }
        getNombreTipo() {
            return (tipo_negocio_1.TIPOS_NEGOCIO.find((t) => t.value === this.tipoNegocio)?.label ??
                'tu negocio');
        }
        get diasActivosCount() {
            return this.diasHorario().filter((d) => d.activo).length;
        }
    };
    __setFunctionName(_classThis, "Onboarding");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Onboarding = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Onboarding = _classThis;
})();
exports.Onboarding = Onboarding;
//# sourceMappingURL=onboarding.js.map