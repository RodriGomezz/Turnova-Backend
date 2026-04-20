// src/app/features/panel/bookings/bookings.ts

import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe, TitleCasePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { BarberService } from '../../../core/services/barber.service';
import { BookingService, MonthDayStat } from '../../../core/services/booking.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { Booking, BookingEstado } from '../../../domain/models/booking.model';
import { Barber } from '../../../domain/models/barber.model';

// ── Utils centralizadas ────────────────────────────────────────────────────
import { toDateString, todayString, formatFechaUY } from '../../../core/utils/date.utils';

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  total: number;
}

type FilterEstado = BookingEstado | 'todos';

// ── Helpers de calendario — extraídos del componente ──────────────────────
// Reemplaza las ~40 líneas de lógica inline del computed calendarDays

function buildBookingsCalendar(
  year: number,
  month: number,
  summary: MonthDayStat[],
  selectedDate: string,
): CalendarDay[] {
  const today = todayString();
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const days: CalendarDay[] = [];

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  // Días del mes anterior
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    days.push({
      date: toDateString(d),
      day: d.getDate(),
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      total: 0,
    });
  }

  // Días del mes actual
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    days.push({
      date: dateStr,
      day: d,
      isCurrentMonth: true,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
      total: summary.find((s) => s.fecha === dateStr)?.total ?? 0,
    });
  }

  // Días del mes siguiente hasta completar 42 celdas
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month, d);
    days.push({
      date: toDateString(date),
      day: d,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      total: 0,
    });
  }

  return days;
}

// ── Componente ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, LowerCasePipe],
  templateUrl: './bookings.html',
  styleUrl: './bookings.scss',
})
export class Bookings implements OnInit {

  // ── Dependencias ──────────────────────────────────────────────────────────

  private readonly bookingService = inject(BookingService);
  private readonly barberService  = inject(BarberService);
  private readonly toastService   = inject(ToastService);
  readonly terms                  = inject(TerminologyService);

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly bookings      = signal<Booking[]>([]);
  readonly barbers       = signal<Barber[]>([]);
  readonly monthSummary  = signal<MonthDayStat[]>([]);
  readonly loading       = signal(true);
  readonly loadingMonth  = signal(false);
  readonly filterEstado  = signal<FilterEstado>('todos');
  readonly search        = signal('');
  readonly selectedFecha = signal(todayString());
  readonly currentYear   = signal(new Date().getFullYear());
  readonly currentMonth  = signal(new Date().getMonth() + 1);

  // ── Constantes de UI ─────────────────────────────────────────────────────

  readonly MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  readonly DIAS_HEADER = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  // ── Computeds ─────────────────────────────────────────────────────────────

  readonly filtered = computed(() => {
    let list = this.bookings();

    if (this.filterEstado() !== 'todos') {
      list = list.filter((b) => b.estado === this.filterEstado());
    }

    const q = this.search().toLowerCase().trim();
    if (q) {
      list = list.filter(
        (b) =>
          b.cliente_nombre.toLowerCase().includes(q) ||
          b.cliente_email.toLowerCase().includes(q) ||
          b.cliente_telefono.includes(q),
      );
    }

    return list;
  });

  // calendarDays delega en la función pura buildBookingsCalendar
  // — testeable de forma aislada sin instanciar el componente
  readonly calendarDays = computed<CalendarDay[]>(() =>
    buildBookingsCalendar(
      this.currentYear(),
      this.currentMonth(),
      this.monthSummary(),
      this.selectedFecha(),
    ),
  );

  readonly totalPendientes  = computed(() =>
    this.bookings().filter((b) => b.estado === 'pendiente').length,
  );
  readonly totalConfirmadas = computed(() =>
    this.bookings().filter((b) => b.estado === 'confirmada').length,
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadInitial();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  private loadInitial(): void {
    this.loading.set(true);

    forkJoin({
      barbers:  this.barberService.list(),
      bookings: this.bookingService.getByDate(this.selectedFecha()),
      month:    this.bookingService.getMonthSummary(
        this.currentYear(),
        this.currentMonth(),
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ barbers, bookings, month }) => {
          this.barbers.set(barbers);
          this.bookings.set(bookings);
          this.monthSummary.set(month.summary);
        },
        error: () => this.toastService.error('Error al cargar los turnos'),
      });
  }

  private loadMonth(): void {
    this.loadingMonth.set(true);
    this.bookingService
      .getMonthSummary(this.currentYear(), this.currentMonth())
      .pipe(finalize(() => this.loadingMonth.set(false)))
      .subscribe({
        next: (res) => this.monthSummary.set(res.summary),
        error: () => this.toastService.error('Error al cargar el resumen del mes'),
      });
  }

  private loadBookings(): void {
    this.loading.set(true);
    this.bookingService
      .getByDate(this.selectedFecha())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (bookings) => this.bookings.set(bookings),
        error: () => this.toastService.error('Error al cargar los turnos del día'),
      });
  }

  // ── Navegación de calendario ──────────────────────────────────────────────

  prevMonth(): void {
    if (this.currentMonth() === 1) {
      this.currentMonth.set(12);
      this.currentYear.set(this.currentYear() - 1);
    } else {
      this.currentMonth.set(this.currentMonth() - 1);
    }
    this.loadMonth();
  }

  nextMonth(): void {
    if (this.currentMonth() === 12) {
      this.currentMonth.set(1);
      this.currentYear.set(this.currentYear() + 1);
    } else {
      this.currentMonth.set(this.currentMonth() + 1);
    }
    this.loadMonth();
  }

  goToday(): void {
    const now = new Date();
    this.currentYear.set(now.getFullYear());
    this.currentMonth.set(now.getMonth() + 1);
    this.selectedFecha.set(todayString());
    this.loadMonth();
    this.loadBookings();
  }

  selectDay(day: CalendarDay): void {
    if (!day.isCurrentMonth) return;
    this.selectedFecha.set(day.date);
    this.loadBookings();
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  updateEstado(id: string, estado: BookingEstado): void {
    this.bookingService.updateEstado(id, estado).subscribe({
      next: () => {
        this.loadBookings();
        this.toastService.success(
          estado === 'confirmada' ? 'Turno confirmado' : 'Turno cancelado',
        );
      },
      error: () => this.toastService.error('Error al actualizar el turno'),
    });
  }

  // ── Handlers de formulario ────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onFilterChange(event: Event): void {
    this.filterEstado.set(
      (event.target as HTMLSelectElement).value as FilterEstado,
    );
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  getBarberNombre(barberId: string): string {
    return this.barbers().find((b) => b.id === barberId)?.nombre ?? '—';
  }

  getServiceNombre(booking: Booking): string {
    return booking.services?.nombre ?? 'Servicio';
  }

  formatFecha(fecha: string): string {
    return formatFechaUY(fecha);
  }

  isToday(fecha: string): boolean {
    return fecha === todayString();
  }
}
