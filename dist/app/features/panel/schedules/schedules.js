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
exports.Schedules = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const common_1 = require("@angular/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const schedule_service_1 = require("../../../core/services/schedule.service");
const barber_service_1 = require("../../../core/services/barber.service");
const toast_service_1 = require("../../../core/services/toast.service");
const DIAS = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
];
const DEFAULT_HORA_INICIO = '09:00';
const DEFAULT_HORA_FIN = '20:00';
const EMPTY_BLOCK_FORM = {
    fecha: '',
    fecha_fin: '',
    motivo: '',
    barber_id: '',
};
let Schedules = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-schedules',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.TitleCasePipe],
            templateUrl: './schedules.html',
            styleUrl: './schedules.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Schedules = _classThis = class {
        constructor() {
            this.scheduleService = (0, core_1.inject)(schedule_service_1.ScheduleService);
            this.barberService = (0, core_1.inject)(barber_service_1.BarberService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.schedules = (0, core_1.signal)([]);
            this.blockedDates = (0, core_1.signal)([]);
            this.barbers = (0, core_1.signal)([]);
            this.loading = (0, core_1.signal)(true);
            this.savingDia = (0, core_1.signal)(null);
            this.showBlockForm = (0, core_1.signal)(false);
            this.savingBlock = (0, core_1.signal)(false);
            this.confirmingUnblockId = (0, core_1.signal)(null);
            // Buffer de edición separado del servidor — evita que el computed
            // resetee los valores que el usuario está editando.
            this.editBuffer = (0, core_1.signal)(new Map());
            this.blockForm = { ...EMPTY_BLOCK_FORM };
            // ── Computeds ─────────────────────────────────────────────────────────────
            this.dias = (0, core_1.computed)(() => {
                const schedules = this.schedules();
                return [1, 2, 3, 4, 5, 6, 0].map((dia) => {
                    const schedule = schedules.find((s) => s.dia_semana === dia && s.barber_id === null) ??
                        null;
                    return {
                        dia_semana: dia,
                        label: DIAS[dia],
                        schedule,
                        activo: !!schedule,
                    };
                });
            });
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            this.loadInitial();
        }
        // ── Data ───────────────────────────────────────────────────────────────────
        loadInitial() {
            this.loading.set(true);
            (0, rxjs_1.forkJoin)({
                schedules: this.scheduleService.listSchedules(),
                blockedDates: this.scheduleService.listBlockedDates(),
                barbers: this.barberService.list(),
            })
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: ({ schedules, blockedDates, barbers }) => {
                    this.schedules.set(schedules);
                    this.blockedDates.set(blockedDates);
                    this.barbers.set(barbers);
                    this.initEditBuffer(schedules);
                },
                error: () => this.toastService.error('Error al cargar los horarios'),
            });
        }
        reloadSchedules() {
            (0, rxjs_1.forkJoin)({
                schedules: this.scheduleService.listSchedules(),
                blockedDates: this.scheduleService.listBlockedDates(),
            }).subscribe({
                next: ({ schedules, blockedDates }) => {
                    this.schedules.set(schedules);
                    this.blockedDates.set(blockedDates);
                    this.initEditBuffer(schedules);
                },
                error: () => this.toastService.error('Error al actualizar los horarios'),
            });
        }
        initEditBuffer(schedules) {
            const buffer = new Map();
            for (const s of schedules) {
                if (s.barber_id === null) {
                    buffer.set(s.dia_semana, {
                        hora_inicio: s.hora_inicio.slice(0, 5),
                        hora_fin: s.hora_fin.slice(0, 5),
                    });
                }
            }
            this.editBuffer.set(buffer);
        }
        // ── Edit buffer accessors ──────────────────────────────────────────────────
        getHorario(dia) {
            return (this.editBuffer().get(dia) ?? {
                hora_inicio: DEFAULT_HORA_INICIO,
                hora_fin: DEFAULT_HORA_FIN,
            });
        }
        setHorario(dia, field, value) {
            const current = this.getHorario(dia);
            const next = new Map(this.editBuffer());
            next.set(dia, { ...current, [field]: value });
            this.editBuffer.set(next);
        }
        // ── Schedule actions ───────────────────────────────────────────────────────
        toggleDia(dia) {
            this.savingDia.set(dia.dia_semana);
            if (dia.activo && dia.schedule) {
                this.scheduleService
                    .deleteSchedule(dia.schedule.id)
                    .pipe((0, operators_1.finalize)(() => this.savingDia.set(null)))
                    .subscribe({
                    next: () => {
                        this.reloadSchedules();
                        this.toastService.success('Día desactivado');
                    },
                    error: () => this.toastService.error('Error al actualizar el día'),
                });
            }
            else {
                this.scheduleService
                    .createSchedule({
                    dia_semana: dia.dia_semana,
                    hora_inicio: DEFAULT_HORA_INICIO,
                    hora_fin: DEFAULT_HORA_FIN,
                })
                    .pipe((0, operators_1.finalize)(() => this.savingDia.set(null)))
                    .subscribe({
                    next: () => {
                        this.reloadSchedules();
                        this.toastService.success('Día activado');
                    },
                    error: () => this.toastService.error('Error al actualizar el día'),
                });
            }
        }
        saveHorario(dia) {
            if (!dia.schedule)
                return;
            const { hora_inicio, hora_fin } = this.getHorario(dia.dia_semana);
            this.savingDia.set(dia.dia_semana);
            this.scheduleService
                .updateSchedule(dia.schedule.id, { hora_inicio, hora_fin })
                .pipe((0, operators_1.finalize)(() => this.savingDia.set(null)))
                .subscribe({
                next: () => this.toastService.success('Horario actualizado'),
                error: () => this.toastService.error('Error al guardar el horario'),
            });
        }
        // ── Block actions ──────────────────────────────────────────────────────────
        openBlockForm() {
            this.blockForm = { ...EMPTY_BLOCK_FORM };
            this.showBlockForm.set(true);
        }
        closeBlockForm() {
            this.showBlockForm.set(false);
        }
        saveBlock() {
            if (!this.blockForm.fecha) {
                this.toastService.error('La fecha de inicio es requerida');
                return;
            }
            const fechaFin = this.blockForm.fecha_fin || this.blockForm.fecha;
            if (fechaFin < this.blockForm.fecha) {
                this.toastService.error('La fecha de fin no puede ser anterior a la de inicio');
                return;
            }
            this.savingBlock.set(true);
            this.scheduleService
                .createBlockedDate({
                fecha: this.blockForm.fecha,
                fecha_fin: fechaFin,
                motivo: this.blockForm.motivo || undefined,
                barber_id: this.blockForm.barber_id || undefined,
            })
                .pipe((0, operators_1.finalize)(() => this.savingBlock.set(false)))
                .subscribe({
                next: () => {
                    this.closeBlockForm();
                    this.reloadSchedules();
                    this.toastService.success('Fecha bloqueada');
                },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al bloquear la fecha'),
            });
        }
        confirmUnblock(id) {
            this.confirmingUnblockId.set(id);
        }
        cancelUnblock() {
            this.confirmingUnblockId.set(null);
        }
        deleteBlock(id) {
            this.scheduleService
                .deleteBlockedDate(id)
                .pipe((0, operators_1.finalize)(() => this.confirmingUnblockId.set(null)))
                .subscribe({
                next: () => {
                    this.reloadSchedules();
                    this.toastService.success('Fecha desbloqueada');
                },
                error: () => this.toastService.error('Error al desbloquear la fecha'),
            });
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        isSaving(dia) {
            return this.savingDia() === dia;
        }
        formatFecha(fecha) {
            return new Date(fecha + 'T00:00:00').toLocaleDateString('es-UY', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
            });
        }
    };
    __setFunctionName(_classThis, "Schedules");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Schedules = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Schedules = _classThis;
})();
exports.Schedules = Schedules;
//# sourceMappingURL=schedules.js.map