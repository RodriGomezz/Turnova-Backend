import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  ScheduleService,
  Schedule,
  BlockedDate,
} from '../../../core/services/schedule.service';
import { BarberService } from '../../../core/services/barber.service';
import { ToastService } from '../../../core/services/toast.service';
import { Barber } from '../../../domain/models/barber.model';

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

const EMPTY_BLOCK_FORM: BlockForm = {
  fecha: '',
  fecha_fin: '',
  motivo: '',
  barber_id: '',
};

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
})
export class Schedules implements OnInit {
  private readonly scheduleService = inject(ScheduleService);
  private readonly barberService = inject(BarberService);
  private readonly toastService = inject(ToastService);

  readonly schedules = signal<Schedule[]>([]);
  readonly blockedDates = signal<BlockedDate[]>([]);
  readonly barbers = signal<Barber[]>([]);
  readonly loading = signal(true);
  readonly savingDia = signal<number | null>(null);
  readonly showBlockForm = signal(false);
  readonly savingBlock = signal(false);
  readonly confirmingUnblockId = signal<string | null>(null);

  // Buffer de edición separado del servidor — evita que el computed
  // resetee los valores que el usuario está editando.
  private readonly editBuffer = signal<Map<number, HorarioEdit>>(new Map());

  blockForm: BlockForm = { ...EMPTY_BLOCK_FORM };

  // ── Computeds ─────────────────────────────────────────────────────────────

  readonly dias = computed<DiaConfig[]>(() => {
    const schedules = this.schedules();
    return ([1, 2, 3, 4, 5, 6, 0] as const).map((dia) => {
      const schedule =
        schedules.find((s) => s.dia_semana === dia && s.barber_id === null) ??
        null;
      return {
        dia_semana: dia,
        label: DIAS[dia],
        schedule,
        activo: !!schedule,
      };
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadInitial();
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  private loadInitial(): void {
    this.loading.set(true);

    forkJoin({
      schedules: this.scheduleService.listSchedules(),
      blockedDates: this.scheduleService.listBlockedDates(),
      barbers: this.barberService.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
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

  private reloadSchedules(): void {
    forkJoin({
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

  private initEditBuffer(schedules: Schedule[]): void {
    const buffer = new Map<number, HorarioEdit>();
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

  getHorario(dia: number): HorarioEdit {
    return (
      this.editBuffer().get(dia) ?? {
        hora_inicio: DEFAULT_HORA_INICIO,
        hora_fin: DEFAULT_HORA_FIN,
      }
    );
  }

  setHorario(dia: number, field: keyof HorarioEdit, value: string): void {
    const current = this.getHorario(dia);
    const next = new Map(this.editBuffer());
    next.set(dia, { ...current, [field]: value });
    this.editBuffer.set(next);
  }

  // ── Schedule actions ───────────────────────────────────────────────────────

  toggleDia(dia: DiaConfig): void {
    this.savingDia.set(dia.dia_semana);

    if (dia.activo && dia.schedule) {
      this.scheduleService
        .deleteSchedule(dia.schedule.id)
        .pipe(finalize(() => this.savingDia.set(null)))
        .subscribe({
          next: () => {
            this.reloadSchedules();
            this.toastService.success('Día desactivado');
          },
          error: () => this.toastService.error('Error al actualizar el día'),
        });
    } else {
      this.scheduleService
        .createSchedule({
          dia_semana: dia.dia_semana,
          hora_inicio: DEFAULT_HORA_INICIO,
          hora_fin: DEFAULT_HORA_FIN,
        })
        .pipe(finalize(() => this.savingDia.set(null)))
        .subscribe({
          next: () => {
            this.reloadSchedules();
            this.toastService.success('Día activado');
          },
          error: () => this.toastService.error('Error al actualizar el día'),
        });
    }
  }

  saveHorario(dia: DiaConfig): void {
    if (!dia.schedule) return;

    const { hora_inicio, hora_fin } = this.getHorario(dia.dia_semana);
    this.savingDia.set(dia.dia_semana);

    this.scheduleService
      .updateSchedule(dia.schedule.id, { hora_inicio, hora_fin })
      .pipe(finalize(() => this.savingDia.set(null)))
      .subscribe({
        next: () => this.toastService.success('Horario actualizado'),
        error: () => this.toastService.error('Error al guardar el horario'),
      });
  }

  // ── Block actions ──────────────────────────────────────────────────────────

  openBlockForm(): void {
    this.blockForm = { ...EMPTY_BLOCK_FORM };
    this.showBlockForm.set(true);
  }

  closeBlockForm(): void {
    this.showBlockForm.set(false);
  }

  saveBlock(): void {
    if (!this.blockForm.fecha) {
      this.toastService.error('La fecha de inicio es requerida');
      return;
    }

    const fechaFin = this.blockForm.fecha_fin || this.blockForm.fecha;
    if (fechaFin < this.blockForm.fecha) {
      this.toastService.error(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
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
      .pipe(finalize(() => this.savingBlock.set(false)))
      .subscribe({
        next: () => {
          this.closeBlockForm();
          this.reloadSchedules();
          this.toastService.success('Fecha bloqueada');
        },
        error: (err) =>
          this.toastService.error(
            err.error?.error ?? 'Error al bloquear la fecha',
          ),
      });
  }

  confirmUnblock(id: string): void {
    this.confirmingUnblockId.set(id);
  }

  cancelUnblock(): void {
    this.confirmingUnblockId.set(null);
  }

  deleteBlock(id: string): void {
    this.scheduleService
      .deleteBlockedDate(id)
      .pipe(finalize(() => this.confirmingUnblockId.set(null)))
      .subscribe({
        next: () => {
          this.reloadSchedules();
          this.toastService.success('Fecha desbloqueada');
        },
        error: () => this.toastService.error('Error al desbloquear la fecha'),
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  isSaving(dia: number): boolean {
    return this.savingDia() === dia;
  }

  formatFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
