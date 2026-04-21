import { OnInit } from '@angular/core';
import { Schedule } from '../../../core/services/schedule.service';
interface DiaConfig {
    dia_semana: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    label: string;
    schedule: Schedule | null;
    activo: boolean;
}
interface HorarioEdit {
    hora_inicio: string;
    hora_fin: string;
}
interface BlockForm {
    fecha: string;
    fecha_fin: string;
    motivo: string;
    barber_id: string;
}
export declare class Schedules implements OnInit {
    private readonly scheduleService;
    private readonly barberService;
    private readonly toastService;
    readonly schedules: any;
    readonly blockedDates: any;
    readonly barbers: any;
    readonly loading: any;
    readonly savingDia: any;
    readonly showBlockForm: any;
    readonly savingBlock: any;
    readonly confirmingUnblockId: any;
    private readonly editBuffer;
    blockForm: BlockForm;
    readonly dias: any;
    ngOnInit(): void;
    private loadInitial;
    private reloadSchedules;
    private initEditBuffer;
    getHorario(dia: number): HorarioEdit;
    setHorario(dia: number, field: keyof HorarioEdit, value: string): void;
    toggleDia(dia: DiaConfig): void;
    saveHorario(dia: DiaConfig): void;
    openBlockForm(): void;
    closeBlockForm(): void;
    saveBlock(): void;
    confirmUnblock(id: string): void;
    cancelUnblock(): void;
    deleteBlock(id: string): void;
    isSaving(dia: number): boolean;
    formatFecha(fecha: string): string;
}
export {};
//# sourceMappingURL=schedules.d.ts.map