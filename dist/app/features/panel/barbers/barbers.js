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
exports.Barbers = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const common_1 = require("@angular/common");
const router_1 = require("@angular/router");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const barber_service_1 = require("../../../core/services/barber.service");
const storage_service_1 = require("../../../core/services/storage.service");
const business_service_1 = require("../../../core/services/business.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE_MB = 2;
let Barbers = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-barbers',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.LowerCasePipe, router_1.RouterLink],
            templateUrl: './barbers.html',
            styleUrl: './barbers.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Barbers = _classThis = class {
        constructor() {
            this.barberService = (0, core_1.inject)(barber_service_1.BarberService);
            this.storageService = (0, core_1.inject)(storage_service_1.StorageService);
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terms = (0, core_1.inject)(terminology_service_1.TerminologyService);
            this.barbers = (0, core_1.signal)([]);
            this.loading = (0, core_1.signal)(true);
            this.saving = (0, core_1.signal)(false);
            this.showForm = (0, core_1.signal)(false);
            this.editingId = (0, core_1.signal)(null);
            this.uploadingId = (0, core_1.signal)(null);
            this.confirmingDeleteId = (0, core_1.signal)(null);
            this.excedeLimit = (0, core_1.signal)(false);
            this.maxBarberos = (0, core_1.signal)(1);
            this.totalBarberos = (0, core_1.signal)(0);
            this.form = { nombre: '', descripcion: '', orden: 0 };
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            this.loadInitial();
        }
        // ── Data ───────────────────────────────────────────────────────────────────
        loadInitial() {
            this.loading.set(true);
            (0, rxjs_1.forkJoin)({
                barbers: this.barberService.list(),
                status: this.businessService.getStatus(),
            })
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: ({ barbers, status }) => {
                    this.barbers.set(barbers);
                    this.excedeLimit.set(status.excedeLimit);
                    this.maxBarberos.set(status.maxBarberos);
                    this.totalBarberos.set(status.totalBarberos);
                },
                error: () => this.toastService.error('Error al cargar los profesionales'),
            });
        }
        reloadBarbers() {
            this.barberService.list().subscribe({
                next: (barbers) => this.barbers.set(barbers),
                error: () => this.toastService.error('Error al actualizar la lista'),
            });
        }
        // ── Form ───────────────────────────────────────────────────────────────────
        openCreate() {
            this.editingId.set(null);
            this.form = { nombre: '', descripcion: '', orden: this.barbers().length };
            this.showForm.set(true);
        }
        openEdit(barber) {
            this.editingId.set(barber.id);
            this.form = {
                nombre: barber.nombre,
                descripcion: barber.descripcion ?? '',
                orden: barber.orden,
            };
            this.showForm.set(true);
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
            this.saving.set(true);
            const id = this.editingId();
            const term = this.terms.profesional();
            const request$ = id
                ? this.barberService.update(id, this.form)
                : this.barberService.create(this.form);
            request$.pipe((0, operators_1.finalize)(() => this.saving.set(false))).subscribe({
                next: () => {
                    this.reloadBarbers();
                    this.closeForm();
                    this.toastService.success(id ? `${term} actualizado` : `${term} creado`);
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
            this.barberService
                .delete(id)
                .pipe((0, operators_1.finalize)(() => this.confirmingDeleteId.set(null)))
                .subscribe({
                next: () => {
                    this.reloadBarbers();
                    this.toastService.success(`${this.terms.profesional()} desactivado`);
                },
                error: () => this.toastService.error(`Error al desactivar el ${this.terms.profesional().toLowerCase()}`),
            });
        }
        // ── Photo ──────────────────────────────────────────────────────────────────
        onPhotoSelected(event, barberId) {
            const input = event.target;
            const file = input.files?.[0];
            if (!file)
                return;
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                this.toastService.error('Solo se permiten imágenes JPG, PNG o WEBP');
                return;
            }
            if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
                this.toastService.error(`La imagen no puede superar ${MAX_PHOTO_SIZE_MB}MB`);
                return;
            }
            this.uploadingId.set(barberId);
            this.storageService.uploadBarberPhoto(file, barberId).subscribe({
                next: (url) => {
                    this.barberService.update(barberId, { foto_url: url }).subscribe({
                        next: () => {
                            this.reloadBarbers();
                            this.uploadingId.set(null);
                        },
                        error: () => {
                            this.toastService.error('Error al guardar la foto');
                            this.uploadingId.set(null);
                        },
                    });
                },
                error: () => {
                    this.toastService.error('Error al subir la foto');
                    this.uploadingId.set(null);
                },
            });
        }
    };
    __setFunctionName(_classThis, "Barbers");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Barbers = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Barbers = _classThis;
})();
exports.Barbers = Barbers;
//# sourceMappingURL=barbers.js.map