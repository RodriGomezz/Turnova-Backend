import { Component, signal, inject, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { BarberService } from '../../../core/services/barber.service';
import { ServiceService } from '../../../core/services/service.service';
import { ScheduleService } from '../../../core/services/schedule.service';
import { BusinessService } from '../../../core/services/business.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { TIPOS_NEGOCIO } from '../../../core/models/tipo-negocio';
import { ServiceDefault } from '../../../domain/models/service.model';
import { esOscuro } from '../../../core/utils/color.utils';

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const DIAS_SEMANA = [
  { dia: 1, label: 'Lunes' },
  { dia: 2, label: 'Martes' },
  { dia: 3, label: 'Miércoles' },
  { dia: 4, label: 'Jueves' },
  { dia: 5, label: 'Viernes' },
  { dia: 6, label: 'Sábado' },
  { dia: 0, label: 'Domingo' },
] as const;

interface DiaHorario {
  dia: number;
  label: string;
  activo: boolean;
  hora_inicio: string;
  hora_fin: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, LowerCasePipe],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly barberService = inject(BarberService);
  private readonly serviceService = inject(ServiceService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly businessService = inject(BusinessService);
  private readonly toastService = inject(ToastService);
  readonly terms = inject(TerminologyService);

  readonly completed = output<void>();
  readonly skipped = output<void>();

  readonly step = signal<OnboardingStep>(1);
  readonly saving = signal(false);
  private tipoNegocio = 'otro';

  // ── Step 1 — Profesional ───────────────────────────────────────────────────
  readonly profesionalNombre = signal('');
  readonly profesionalDescripcion = signal('');

  // ── Step 2 — Servicio ──────────────────────────────────────────────────────
  readonly servicioNombre = signal('');
  readonly servicioDuracion = signal(30);
  readonly servicioPrecio = signal(0);
  readonly defaults = signal<ServiceDefault[]>([]);
  readonly showDefaults = signal(false);

  // ── Step 3 — Horarios ──────────────────────────────────────────────────────
  readonly diasHorario = signal<DiaHorario[]>(
    DIAS_SEMANA.map((d) => ({
      dia: d.dia,
      label: d.label,
      activo: d.dia >= 1 && d.dia <= 6, // Lunes a sábado por defecto
      hora_inicio: '09:00',
      hora_fin: '19:00',
    })),
  );

  // ── Step 4 — Colores ───────────────────────────────────────────────────────
  readonly colorFondo = signal('#0A0A0A');
  readonly colorAcento = signal('#C9A84C');

  readonly paletas = [
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

  readonly totalSteps = 5;

  readonly progressPct = computed(() =>
    Math.round(((this.step() - 1) / this.totalSteps) * 100),
  );

  constructor() {
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

  private loadDefaults(): void {
    this.serviceService.listDefaults(this.tipoNegocio).subscribe({
      next: (defaults) => this.defaults.set(defaults),
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  next(): void {
    const current = this.step();
    if (current === 1 && !this.validateStep1()) return;
    if (current === 2 && !this.validateStep2()) return;
    if (current < this.totalSteps) {
      this.step.set((current + 1) as OnboardingStep);
    }
  }

  back(): void {
    const current = this.step();
    if (current > 1) this.step.set((current - 1) as OnboardingStep);
  }

  skip(): void {
    this.businessService.completeOnboarding().subscribe();
    this.skipped.emit();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validateStep1(): boolean {
    if (!this.profesionalNombre().trim()) {
      this.toastService.error(
        `El nombre del ${this.terms.profesional().toLowerCase()} es requerido`,
      );
      return false;
    }
    return true;
  }

  private validateStep2(): boolean {
    if (!this.servicioNombre().trim()) {
      this.toastService.error(
        `El nombre del ${this.terms.servicio().toLowerCase()} es requerido`,
      );
      return false;
    }
    if (this.servicioPrecio() < 0) {
      this.toastService.error('El precio no puede ser negativo');
      return false;
    }
    return true;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  useDefault(def: ServiceDefault): void {
    this.servicioNombre.set(def.nombre);
    this.servicioDuracion.set(def.duracion_minutos);
    this.servicioPrecio.set(def.precio_sugerido);
    this.showDefaults.set(false);
  }

  selectPaleta(paleta: { fondo: string; acento: string }): void {
    this.colorFondo.set(paleta.fondo);
    this.colorAcento.set(paleta.acento);
  }

  finish(): void {
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
      ...diasActivos.map((d) =>
        this.scheduleService
          .createSchedule({
            dia_semana: d.dia as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            hora_inicio: d.hora_inicio,
            hora_fin: d.hora_fin,
          })
          .toPromise(),
      ),

      // Colores
      this.businessService
        .update({
          color_fondo: this.colorFondo(),
          color_acento: this.colorAcento(),
          color_superficie: esOscuro(this.colorFondo()) ? '#1C1C1E' : '#FFFFFF',
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

  toggleDia(dia: DiaHorario): void {
    this.diasHorario.update((dias) =>
      dias.map((d) => (d.dia === dia.dia ? { ...d, activo: !d.activo } : d)),
    );
  }

  setHorario(
    dia: number,
    field: 'hora_inicio' | 'hora_fin',
    value: string,
  ): void {
    this.diasHorario.update((dias) =>
      dias.map((d) => (d.dia === dia ? { ...d, [field]: value } : d)),
    );
  }

  esOscuro(hex: string): boolean {
    return esOscuro(hex);
  }

  getNombreTipo(): string {
    return (
      TIPOS_NEGOCIO.find((t) => t.value === this.tipoNegocio)?.label ??
      'tu negocio'
    );
  }

  get diasActivosCount(): number {
    return this.diasHorario().filter((d) => d.activo).length;
  }
}
