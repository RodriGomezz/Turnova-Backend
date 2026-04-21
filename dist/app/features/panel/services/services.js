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
exports.Services = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const common_1 = require("@angular/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const service_service_1 = require("../../../core/services/service.service");
const business_service_1 = require("../../../core/services/business.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
const EMPTY_FORM = {
    nombre: '',
    descripcion: '',
    incluye: '',
    duracion_minutos: 30,
    precio: 0,
    precio_hasta: null,
};
let Services = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-services',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.LowerCasePipe],
            templateUrl: './services.html',
            styleUrl: './services.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Services = _classThis = class {
        constructor() {
            this.serviceService = (0, core_1.inject)(service_service_1.ServiceService);
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terms = (0, core_1.inject)(terminology_service_1.TerminologyService);
            this.services = (0, core_1.signal)([]);
            this.defaults = (0, core_1.signal)([]);
            this.loading = (0, core_1.signal)(true);
            this.saving = (0, core_1.signal)(false);
            this.showForm = (0, core_1.signal)(false);
            this.showDefaults = (0, core_1.signal)(false);
            this.editingId = (0, core_1.signal)(null);
            this.confirmingDeleteId = (0, core_1.signal)(null);
            this.tipoNegocio = '';
            this.form = { ...EMPTY_FORM };
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            this.loadInitial();
        }
        // ── Data ───────────────────────────────────────────────────────────────────
        loadInitial() {
            this.loading.set(true);
            this.businessService
                .get()
                .pipe((0, operators_1.tap)((business) => {
                this.tipoNegocio = business.tipo_negocio ?? 'otro';
            }), (0, rxjs_1.switchMap)((business) => (0, rxjs_1.forkJoin)({
                services: this.serviceService.list(),
                defaults: this.serviceService.listDefaults(business.tipo_negocio ?? 'otro'),
            })), (0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: ({ services, defaults }) => {
                    this.services.set(services);
                    this.defaults.set(defaults);
                },
                error: () => this.toastService.error('Error al cargar los servicios'),
            });
        }
        reloadServices() {
            this.serviceService.list().subscribe({
                next: (services) => this.services.set(services),
                error: () => this.toastService.error('Error al actualizar la lista'),
            });
        }
        // ── Form ───────────────────────────────────────────────────────────────────
        openCreate() {
            this.editingId.set(null);
            this.form = { ...EMPTY_FORM };
            this.showDefaults.set(false);
            this.showForm.set(true);
        }
        openEdit(service) {
            this.editingId.set(service.id);
            this.form = {
                nombre: service.nombre,
                descripcion: service.descripcion ?? '',
                incluye: service.incluye ?? '',
                duracion_minutos: service.duracion_minutos,
                precio: service.precio,
                precio_hasta: service.precio_hasta,
            };
            this.showDefaults.set(false);
            this.showForm.set(true);
        }
        useDefault(def) {
            this.form = {
                nombre: def.nombre,
                descripcion: def.descripcion ?? '',
                incluye: def.incluye ?? '',
                duracion_minutos: def.duracion_minutos,
                precio: def.precio_sugerido,
                precio_hasta: def.precio_hasta,
            };
            this.showDefaults.set(false);
        }
        closeForm() {
            this.showForm.set(false);
            this.editingId.set(null);
        }
        save() {
            if (!this.form.nombre.trim()) {
                this.toastService.error('El nombre es requerido');
                return;
            }
            if (this.form.precio < 0) {
                this.toastService.error('El precio no puede ser negativo');
                return;
            }
            if (this.form.precio_hasta !== null &&
                this.form.precio_hasta < this.form.precio) {
                this.toastService.error('El precio máximo no puede ser menor al precio base');
                return;
            }
            this.saving.set(true);
            const id = this.editingId();
            const payload = {
                ...this.form,
                precio_hasta: this.form.precio_hasta ?? undefined,
                descripcion: this.form.descripcion || undefined,
                incluye: this.form.incluye || undefined,
            };
            const request$ = id
                ? this.serviceService.update(id, payload)
                : this.serviceService.create(payload);
            request$.pipe((0, operators_1.finalize)(() => this.saving.set(false))).subscribe({
                next: () => {
                    this.reloadServices();
                    this.closeForm();
                    this.toastService.success(id ? 'Servicio actualizado' : 'Servicio creado');
                },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al guardar'),
            });
        }
        // ── Delete ─────────────────────────────────────────────────────────────────
        confirmDelete(id) {
            this.confirmingDeleteId.set(id);
        }
        cancelDelete() {
            this.confirmingDeleteId.set(null);
        }
        delete(id) {
            this.serviceService
                .delete(id)
                .pipe((0, operators_1.finalize)(() => this.confirmingDeleteId.set(null)))
                .subscribe({
                next: () => {
                    this.reloadServices();
                    this.toastService.success('Servicio desactivado');
                },
                error: () => this.toastService.error('Error al desactivar el servicio'),
            });
        }
        // ── Helpers ────────────────────────────────────────────────────────────────
        formatPrecio(service) {
            const base = `$${service.precio.toLocaleString('es-UY')}`;
            return service.precio_hasta
                ? `${base} – $${service.precio_hasta.toLocaleString('es-UY')}`
                : base;
        }
    };
    __setFunctionName(_classThis, "Services");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Services = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Services = _classThis;
})();
exports.Services = Services;
//# sourceMappingURL=services.js.map