import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import {
  PublicBusiness,
  PublicService,
  CreateBookingResponse,
} from '../../../core/services/public.service';
import { SubdomainService } from '../../../core/services/subdomain.service';
import { Barber } from '../../../domain/models/barber.model';
import { Service } from '../../../domain/models/service.model';
import { esOscuro } from '../../../core/utils/color.utils';

type Step = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './booking.html',
  styleUrl: './booking.scss',
})
export class Booking implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly publicService = inject(PublicService);
  private readonly subdomainService = inject(SubdomainService);

  readonly slug = signal('');
  readonly step = signal<Step>(1);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly singleBarber = signal(false);
  readonly loadingSlots = signal(false);
  readonly loadingDays = signal(false);

  readonly barbers = signal<Barber[]>([]);
  readonly services = signal<Service[]>([]);
  readonly slots = signal<{ hora_inicio: string; hora_fin: string }[]>([]);

  readonly selectedBarber = signal<Barber | null>(null);
  readonly selectedService = signal<Service | null>(null);
  readonly selectedFecha = signal('');
  readonly selectedSlot = signal<{
    hora_inicio: string;
    hora_fin: string;
  } | null>(null);
  readonly business = signal<PublicBusiness | null>(null);

  readonly calendarYear = signal(new Date().getFullYear());
  readonly calendarMonth = signal(new Date().getMonth() + 1);
  readonly availableDays = signal<string[]>([]);

  readonly DIAS_HEADER = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
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

  clienteForm = { nombre: '', email: '', telefono: '09' };

  private readonly minFecha = this.dateToString(new Date());

  // ── Computeds ─────────────────────────────────────────────────────────────

  readonly totalSteps = computed(() => (this.singleBarber() ? 3 : 4));

  readonly visualStep = computed(() => {
    const s = this.step();
    if (!this.singleBarber()) return s;
    if (s === 1) return 1;
    if (s === 3) return 2;
    if (s === 4) return 3;
    return s;
  });

  readonly stepLabel = computed(() => {
    const s = this.step();
    const b = this.business();
    const srv = b?.termino_servicio?.toLowerCase() ?? 'servicio';
    const pro = b?.termino_profesional?.toLowerCase() ?? 'profesional';
    const res = b?.termino_reserva?.toLowerCase() ?? 'turno';
    if (s === 1) return `¿Qué ${srv} desea?`;
    if (s === 2 && !this.singleBarber())
      return `¿Con qué ${pro} desea atenderse?`;
    if (s === 2 && this.singleBarber()) return `¿Cuándo desea su ${res}?`;
    if (s === 3)
      return this.singleBarber() ? 'Sus datos' : `¿Cuándo desea su ${res}?`;
    return 'Sus datos';
  });

  readonly confirmarLink = computed(() =>
    this.subdomainService.buildRouterLink(this.slug(), 'confirmar'),
  );

  readonly calendarDays = computed(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const available = this.availableDays();
    const todayStr = this.dateToString(new Date());
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, -i);
      days.push({
        date: this.dateToString(d),
        day: d.getDate(),
        currentMonth: false,
        available: false,
        isToday: false,
      });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        date: dateStr,
        day: d,
        currentMonth: true,
        available: available.includes(dateStr),
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
      });
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month, d);
      days.push({
        date: this.dateToString(date),
        day: d,
        currentMonth: false,
        available: false,
        isToday: false,
      });
    }

    return days;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const slug =
      this.subdomainService.getSlug() ??
      this.route.snapshot.paramMap.get('slug') ??
      '';
    this.slug.set(slug);

    const preselectedServiceId =
      this.route.snapshot.queryParamMap.get('service_id');

    this.publicService.getBusiness(slug).subscribe({
      next: (res) => {
        this.business.set(res.business);
        this.barbers.set(res.barbers);
        this.services.set(res.services);

        if (res.barbers.length === 1) {
          this.selectedBarber.set(res.barbers[0]);
          this.singleBarber.set(true);
        }

        if (preselectedServiceId) {
          const service = res.services.find(
            (s) => s.id === preselectedServiceId,
          );
          if (service) this.selectService(service);
        }

        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el negocio');
        this.loading.set(false);
      },
    });
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  selectService(service: Service): void {
    this.selectedService.set(service);
    if (this.singleBarber()) {
      this.resetCalendar();
      this.loadAvailableDays();
    }
    this.step.set(this.singleBarber() ? 3 : 2);
  }

  selectBarber(barber: Barber): void {
    this.selectedBarber.set(barber);
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.selectedFecha.set('');
    this.resetCalendar();
    this.loadAvailableDays();
    this.step.set(3);
  }

  selectSlot(slot: { hora_inicio: string; hora_fin: string }): void {
    this.selectedSlot.set(slot);
    this.step.set(4);
  }

  goToStep(target: number): void {
    if (target >= this.step()) return;
    if (target <= 1) {
      this.selectedService.set(null);
      this.selectedFecha.set('');
      this.selectedSlot.set(null);
      this.slots.set([]);
    }
    if (target <= 2) {
      this.selectedFecha.set('');
      this.selectedSlot.set(null);
      this.slots.set([]);
    }
    if (target <= 3) {
      this.selectedSlot.set(null);
    }
    this.step.set(target as Step);
    this.error.set(null);
  }

  back(): void {
    const s = this.step();
    this.error.set(null);
    if (s === 1) {
      this.router.navigate(this.subdomainService.buildRouterLink(this.slug()));
      return;
    }
    if (s === 2) {
      this.step.set(1);
      return;
    }
    if (s === 3) {
      this.step.set(this.singleBarber() ? 1 : 2);
      return;
    }
    if (s === 4) {
      this.step.set(3);
      return;
    }
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  confirm(): void {
    if (!this.clienteForm.nombre.trim()) {
      this.error.set('El nombre es requerido');
      return;
    }
    if (!this.clienteForm.email.trim()) {
      this.error.set('El email es requerido');
      return;
    }
    if (
      !this.clienteForm.telefono.trim() ||
      this.clienteForm.telefono === '09'
    ) {
      this.error.set('El teléfono es requerido');
      return;
    }

    const barber = this.selectedBarber()!;
    const service = this.selectedService()!;
    const slot = this.selectedSlot()!;

    this.saving.set(true);
    this.error.set(null);

    this.publicService
      .createBooking(this.slug(), {
        barber_id: barber.id,
        service_id: service.id,
        fecha: this.selectedFecha(),
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
        cliente_nombre: this.clienteForm.nombre,
        cliente_email: this.clienteForm.email,
        cliente_telefono: this.clienteForm.telefono,
      })
      .subscribe({
        next: (res: CreateBookingResponse) => {
          // Solo datos no sensibles en query params — el email NO viaja en URL.
          // El componente confirm carga el negocio por slug directamente.
          this.router.navigate(
            this.subdomainService.buildRouterLink(this.slug(), 'confirmar'),
            {
              queryParams: {
                nombre: this.clienteForm.nombre,
                fecha: this.selectedFecha(),
                hora: slot.hora_inicio.slice(0, 5),
                servicio: service.nombre,
                barbero: barber.nombre,
                estado: res.estado,
              },
            },
          );
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err.error?.error ?? 'No se pudo crear el turno');
        },
      });
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  loadAvailableDays(): void {
    const barber = this.selectedBarber();
    const service = this.selectedService();
    if (!barber || !service) return;

    this.loadingDays.set(true);
    this.publicService
      .getAvailableDays(
        this.slug(),
        barber.id,
        this.calendarYear(),
        this.calendarMonth(),
        service.id,
      )
      .subscribe({
        next: (res) => {
          this.availableDays.set(res.availableDays);
          this.loadingDays.set(false);
        },
        error: () => this.loadingDays.set(false),
      });
  }

  prevMonth(): void {
    if (this.calendarMonth() === 1) {
      this.calendarMonth.set(12);
      this.calendarYear.set(this.calendarYear() - 1);
    } else {
      this.calendarMonth.set(this.calendarMonth() - 1);
    }
    this.clearDateSelection();
    this.loadAvailableDays();
  }

  nextMonth(): void {
    if (this.calendarMonth() === 12) {
      this.calendarMonth.set(1);
      this.calendarYear.set(this.calendarYear() + 1);
    } else {
      this.calendarMonth.set(this.calendarMonth() + 1);
    }
    this.clearDateSelection();
    this.loadAvailableDays();
  }

  onFechaSelected(date: string): void {
    this.selectedFecha.set(date);
    this.onFechaChange();
  }

  onFechaChange(): void {
    this.selectedSlot.set(null);
    this.slots.set([]);
    const barber = this.selectedBarber();
    const service = this.selectedService();
    const fecha = this.selectedFecha();
    if (!barber || !service || !fecha) return;

    this.loadingSlots.set(true);
    this.publicService
      .getSlots(this.slug(), barber.id, fecha, service.id)
      .subscribe({
        next: (res) => {
          const todayStr = this.dateToString(new Date());
          const now = new Date();
          const horaActual = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          this.slots.set(
            res.slots.filter((s) => {
              if (!s.disponible) return false;
              if (fecha === todayStr && s.hora_inicio <= horaActual)
                return false;
              return true;
            }),
          );
          this.loadingSlots.set(false);
        },
        error: () => {
          this.slots.set([]);
          this.loadingSlots.set(false);
        },
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  esOscuro(hex: string): boolean {
    return esOscuro(hex);
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  formatPrecio(service: Service): string {
    const base = `$${service.precio.toLocaleString('es-UY')}`;
    return service.precio_hasta
      ? `${base} – $${service.precio_hasta.toLocaleString('es-UY')}`
      : base;
  }

  private dateToString(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private resetCalendar(): void {
    this.calendarYear.set(new Date().getFullYear());
    this.calendarMonth.set(new Date().getMonth() + 1);
  }

  private clearDateSelection(): void {
    this.selectedFecha.set('');
    this.selectedSlot.set(null);
    this.slots.set([]);
  }
}
