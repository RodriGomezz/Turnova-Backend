// src/app/features/panel/dashboard/dashboard.ts

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { LowerCasePipe, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { BookingService, DaySummary } from '../../../core/services/booking.service';
import { BusinessService } from '../../../core/services/business.service';
import { BusinessStatusService } from '../../../core/services/business-status.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { Booking, BookingEstado } from '../../../domain/models/booking.model';
import { Business } from '../../../domain/models/business.model';
import { Onboarding } from '../onboarding/onboarding';

// ── Utils centralizadas — eliminan duplicación entre componentes ───────────
import { toDateString, todayString, currentTimeString, formatFechaUY } from '../../../core/utils/date.utils';

// ── Constantes de color de ocupación ─────────────────────────────────────
const OCUPACION_LEVELS = [
  { min: 85, label: 'Día lleno',       color: '#22C55E' },
  { min: 60, label: 'Buen ritmo',      color: '#C9A84C' },
  { min: 30, label: 'Ritmo moderado',  color: '#3B82F6' },
  { min: 0,  label: 'Día tranquilo',   color: '#9CA3AF' },
] as const;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TitleCasePipe, LowerCasePipe, RouterLink, Onboarding],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  // ── Dependencias ─────────────────────────────────────────────────────────

  private readonly bookingService  = inject(BookingService);
  private readonly businessService = inject(BusinessService);
  private readonly statusService   = inject(BusinessStatusService);
  private readonly toastService    = inject(ToastService);
  readonly terms                   = inject(TerminologyService);

  // ── Estado ───────────────────────────────────────────────────────────────

  readonly loading         = signal(true);
  readonly bookings        = signal<Booking[]>([]);
  readonly daySummary      = signal<DaySummary | null>(null);
  readonly autoConfirmar   = signal(false);
  readonly excedeLimit     = signal(false);
  readonly maxBarberos     = signal(1);
  readonly selectedFecha   = signal(todayString());
  readonly showOnboarding  = signal(false);

  // isPro y trialDaysLeft vienen del servicio central que consolida
  // business.plan + subscription.status — evita mostrar "trial vencido"
  // a usuarios con suscripción activa.
  readonly isPro         = computed(() => this.statusService.isPro());
  readonly trialDaysLeft = computed(() => this.statusService.trialDaysLeft());

  private readonly business = signal<Business | null>(null);

  // ── Computeds ─────────────────────────────────────────────────────────────

  readonly resumen = computed(() => this.daySummary()?.resumen ?? null);

  readonly barbersSummary = computed(() =>
    (this.daySummary()?.barbers ?? []).filter((b) => b.trabajaHoy),
  );

  readonly businessSlug = computed(() => this.business()?.slug ?? '');

  /**
   * Primera reserva pendiente o confirmada que aún no comenzó.
   * Solo relevante cuando selectedFecha es hoy.
   */
  readonly proximaReserva = computed((): Booking | null => {
    if (!this.isToday()) return null;
    const horaActual = currentTimeString();
    return (
      this.bookings()
        .filter((b) => b.estado !== 'cancelada' && b.hora_inicio >= horaActual)
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0] ?? null
    );
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadData();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  loadData(): void {
    this.loading.set(true);

    forkJoin({
      bookings: this.bookingService.getByDate(this.selectedFecha()),
      summary:  this.bookingService.getDaySummary(this.selectedFecha()),
      business: this.businessService.get(),
      status:   this.businessService.getStatus(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ bookings, summary, business, status }) => {
          this.bookings.set(bookings);
          this.daySummary.set(summary);
          this.business.set(business);
          this.autoConfirmar.set(business.auto_confirmar);
          this.excedeLimit.set(status.excedeLimit);
          this.maxBarberos.set(status.maxBarberos);

          if (!business.onboarding_completed) {
            this.showOnboarding.set(true);
          }
        },
        error: () => this.toastService.error('Error al cargar el dashboard'),
      });
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  onOnboardingCompleted(): void {
    this.showOnboarding.set(false);
    this.loadData();
  }

  onOnboardingSkipped(): void {
    this.showOnboarding.set(false);
  }

  // ── Navegación de fechas ──────────────────────────────────────────────────

  changeDate(offset: number): void {
    const date = new Date(`${this.selectedFecha()}T00:00:00`);
    date.setDate(date.getDate() + offset);
    this.selectedFecha.set(toDateString(date));
    this.loadData();
  }

  goToToday(): void {
    this.selectedFecha.set(todayString());
    this.loadData();
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  updateEstado(id: string, estado: BookingEstado): void {
    this.bookingService.updateEstado(id, estado).subscribe({
      next: () => {
        this.loadData();
        this.toastService.success(
          estado === 'confirmada' ? 'Turno confirmado' : 'Turno cancelado',
        );
      },
      error: () => this.toastService.error('Error al actualizar el turno'),
    });
  }

  copyPublicLink(): void {
    const slug = this.businessSlug();
    if (!slug) return;

    const url =
      window.location.hostname === 'localhost' ||
      window.location.hostname.endsWith('.localhost')
        ? `http://${slug}.localhost:4200`
        : `https://${slug}.turnio.pro`;

    navigator.clipboard.writeText(url);
    this.toastService.success('Link copiado');
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  isToday(): boolean {
    return this.selectedFecha() === todayString();
  }

  isPast(booking: Booking): boolean {
    if (!this.isToday()) return false;
    return booking.hora_fin.slice(0, 5) < currentTimeString();
  }

  getBarberNombre(barberId: string): string {
    return (
      (this.daySummary()?.barbers ?? []).find((b) => b.id === barberId)?.nombre ?? '—'
    );
  }

  getServiceNombre(booking: Booking): string {
    return booking.services?.nombre ?? 'Servicio';
  }

  formatFecha(fecha: string): string {
    return formatFechaUY(fecha);
  }

  getOcupacionLabel(pct: number): string {
    return (
      OCUPACION_LEVELS.find((l) => pct >= l.min)?.label ?? 'Día tranquilo'
    );
  }

  getOcupacionColor(pct: number): string {
    return (
      OCUPACION_LEVELS.find((l) => pct >= l.min)?.color ?? '#9CA3AF'
    );
  }
}
