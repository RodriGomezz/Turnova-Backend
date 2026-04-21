import { OnInit } from '@angular/core';
import { Barber } from '../../../domain/models/barber.model';
interface BarberForm {
    nombre: string;
    descripcion: string;
    orden: number;
}
export declare class Barbers implements OnInit {
    private readonly barberService;
    private readonly storageService;
    private readonly businessService;
    private readonly toastService;
    readonly terms: any;
    readonly barbers: any;
    readonly loading: any;
    readonly saving: any;
    readonly showForm: any;
    readonly editingId: any;
    readonly uploadingId: any;
    readonly confirmingDeleteId: any;
    readonly excedeLimit: any;
    readonly maxBarberos: any;
    readonly totalBarberos: any;
    form: BarberForm;
    ngOnInit(): void;
    private loadInitial;
    private reloadBarbers;
    openCreate(): void;
    openEdit(barber: Barber): void;
    closeForm(): void;
    save(): void;
    confirmDelete(id: string): void;
    cancelDelete(): void;
    delete(id: string): void;
    onPhotoSelected(event: Event, barberId: string): void;
}
export {};
//# sourceMappingURL=barbers.d.ts.map