import { OnInit } from '@angular/core';
import { Service, ServiceDefault } from '../../../domain/models/service.model';
interface ServiceForm {
    nombre: string;
    descripcion: string;
    incluye: string;
    duracion_minutos: number;
    precio: number;
    precio_hasta: number | null;
}
export declare class Services implements OnInit {
    private readonly serviceService;
    private readonly businessService;
    private readonly toastService;
    readonly terms: any;
    readonly services: any;
    readonly defaults: any;
    readonly loading: any;
    readonly saving: any;
    readonly showForm: any;
    readonly showDefaults: any;
    readonly editingId: any;
    readonly confirmingDeleteId: any;
    private tipoNegocio;
    form: ServiceForm;
    ngOnInit(): void;
    private loadInitial;
    private reloadServices;
    openCreate(): void;
    openEdit(service: Service): void;
    useDefault(def: ServiceDefault): void;
    closeForm(): void;
    save(): void;
    confirmDelete(id: string): void;
    cancelDelete(): void;
    delete(id: string): void;
    formatPrecio(service: Service): string;
}
export {};
//# sourceMappingURL=services.d.ts.map