import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { LowerCasePipe, TitleCasePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { StatsService, StatsData } from '../../../core/services/stats.service';
import { BarberService } from '../../../core/services/barber.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { Barber } from '../../../domain/models/barber.model';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [LowerCasePipe, TitleCasePipe],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class Stats implements OnInit {
  private readonly statsService = inject(StatsService);
  private readonly barberService = inject(BarberService);
  private readonly toastService = inject(ToastService);
  readonly terms = inject(TerminologyService);

  readonly loading = signal(true);
  readonly stats = signal<StatsData | null>(null);
  readonly barbers = signal<Barber[]>([]);

  readonly statsYear = signal(new Date().getFullYear());
  readonly statsMonth = signal(new Date().getMonth() + 1);

  readonly MESES = [
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

  // ── Computeds ─────────────────────────────────────────────────────────────

  readonly mesLabel = computed(
    () => `${this.MESES[this.statsMonth() - 1]} ${this.statsYear()}`,
  );

  readonly topProfesionalNombre = computed(() => {
    const id = this.stats()?.topProfesionalId;
    if (!id) return null;
    return this.barbers().find((b) => b.id === id)?.nombre ?? null;
  });

  readonly isCurrentMonth = computed(() => {
    const now = new Date();
    return (
      this.statsYear() === now.getFullYear() &&
      this.statsMonth() === now.getMonth() + 1
    );
  });

  readonly maxDayCount = computed(() => {
    const porDia = this.stats()?.porDia ?? [];
    return Math.max(...porDia.map((d) => d.total), 1);
  });

  readonly maxHoraCount = computed(() => {
    const horas = this.stats()?.distribucionHoras ?? [];
    return Math.max(...horas.map((h) => h.count), 1);
  });

  readonly mejorDia = computed(() => {
    const porDia = this.stats()?.porDia ?? [];
    if (!porDia.length) return null;
    const mejor = porDia.reduce((max, d) => (d.total > max.total ? d : max), {
      fecha: '',
      total: 0,
    });
    return mejor.total > 0 ? mejor : null;
  });

  readonly promedioTurnosDia = computed(() => {
    const porDia = this.stats()?.porDia ?? [];
    const diasConTurnos = porDia.filter((d) => d.total > 0);
    if (!diasConTurnos.length) return 0;
    const total = diasConTurnos.reduce((sum, d) => sum + d.total, 0);
    return Math.round((total / diasConTurnos.length) * 10) / 10;
  });

  readonly ingresoPromedioPorTurno = computed(() => {
    const r = this.stats()?.resumen;
    if (!r || !r.totalTurnos) return 0;
    return Math.round(r.ingresosMes / r.totalTurnos);
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.barberService.list().subscribe({
      next: (barbers) => this.barbers.set(barbers),
    });
    this.loadStats();
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  loadStats(): void {
    this.loading.set(true);
    this.statsService
      .get(this.statsYear(), this.statsMonth())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (stats) => this.stats.set(stats),
        error: () =>
          this.toastService.error('Error al cargar las estadísticas'),
      });
  }

  prevMes(): void {
    if (this.statsMonth() === 1) {
      this.statsMonth.set(12);
      this.statsYear.set(this.statsYear() - 1);
    } else {
      this.statsMonth.set(this.statsMonth() - 1);
    }
    this.loadStats();
  }

  nextMes(): void {
    if (this.isCurrentMonth()) return;
    if (this.statsMonth() === 12) {
      this.statsMonth.set(1);
      this.statsYear.set(this.statsYear() + 1);
    } else {
      this.statsMonth.set(this.statsMonth() + 1);
    }
    this.loadStats();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatVariacion(v: number | null): string {
    if (v === null) return 'Sin datos del mes anterior';
    if (v === 0) return 'Igual que el mes anterior';
    return v > 0 ? `+${v}% vs mes anterior` : `${v}% vs mes anterior`;
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  getDayBarHeight(total: number): number {
    return Math.round((total / this.maxDayCount()) * 100);
  }

  getHoraBarHeight(count: number): number {
    return Math.round((count / this.maxHoraCount()) * 100);
  }

  getPorDiaLast15(): { fecha: string; total: number; day: number }[] {
    const porDia = this.stats()?.porDia ?? [];
    return porDia.slice(-15).map((d) => ({
      ...d,
      day: parseInt(d.fecha.split('-')[2]),
    }));
  }

  get tasaRetencion(): number {
    const r = this.stats()?.resumen;
    if (!r) return 0;
    const total = r.clientesNuevos + r.clientesRecurrentes;
    if (total === 0) return 0;
    return Math.round((r.clientesRecurrentes / total) * 100);
  }
}
