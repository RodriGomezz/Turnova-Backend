import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { forkJoin, switchMap } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { ServiceService } from '../../../core/services/service.service';
import { BusinessService } from '../../../core/services/business.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { Service, ServiceDefault } from '../../../domain/models/service.model';

interface ServiceForm {
  nombre: string;
  descripcion: string;
  incluye: string;
  duracion_minutos: number;
  precio: number;
  precio_hasta: number | null;
}

const EMPTY_FORM: ServiceForm = {
  nombre: '',
  descripcion: '',
  incluye: '',
  duracion_minutos: 30,
  precio: 0,
  precio_hasta: null,
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [FormsModule, LowerCasePipe],
  templateUrl: './services.html',
  styleUrl: './services.scss',
})
export class Services implements OnInit {
  private readonly serviceService = inject(ServiceService);
  private readonly businessService = inject(BusinessService);
  private readonly toastService = inject(ToastService);
  readonly terms = inject(TerminologyService);

  readonly services = signal<Service[]>([]);
  readonly defaults = signal<ServiceDefault[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly showDefaults = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);

  private tipoNegocio = '';

  form: ServiceForm = { ...EMPTY_FORM };

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadInitial();
  }

  // ── Data ───────────────────────────────────────────────────────────────────

private loadInitial(): void {
  this.loading.set(true);

  this.businessService
    .get()
    .pipe(
      tap((business) => {
        this.tipoNegocio = business.tipo_negocio ?? 'otro';
      }),
      switchMap((business) =>
        forkJoin({
          services: this.serviceService.list(),
          defaults: this.serviceService.listDefaults(
            business.tipo_negocio ?? 'otro',
          ),
        }),
      ),
      finalize(() => this.loading.set(false)),
    )
    .subscribe({
      next: ({ services, defaults }) => {
        this.services.set(services);
        this.defaults.set(defaults);
      },
      error: () => this.toastService.error('Error al cargar los servicios'),
    });
}
  private reloadServices(): void {
    this.serviceService.list().subscribe({
      next: (services) => this.services.set(services),
      error: () => this.toastService.error('Error al actualizar la lista'),
    });
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.showDefaults.set(false);
    this.showForm.set(true);
  }

  openEdit(service: Service): void {
    this.editingId.set(service.id);
    this.form = {
      nombre: service.nombre,
      descripcion: service.descripcion ?? '',
      incluye: service.incluye ?? '',
      duracion_minutos: service.duracion_minutos,
      precio: service.precio,
      precio_hasta: service.precio_hasta,
    };
    this.showDefaults.set(false);
    this.showForm.set(true);
  }

  useDefault(def: ServiceDefault): void {
    this.form = {
      nombre: def.nombre,
      descripcion: def.descripcion ?? '',
      incluye: def.incluye ?? '',
      duracion_minutos: def.duracion_minutos,
      precio: def.precio_sugerido,
      precio_hasta: def.precio_hasta,
    };
    this.showDefaults.set(false);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save(): void {
    if (!this.form.nombre.trim()) {
      this.toastService.error('El nombre es requerido');
      return;
    }
    if (this.form.precio < 0) {
      this.toastService.error('El precio no puede ser negativo');
      return;
    }
    if (
      this.form.precio_hasta !== null &&
      this.form.precio_hasta < this.form.precio
    ) {
      this.toastService.error(
        'El precio máximo no puede ser menor al precio base',
      );
      return;
    }

    this.saving.set(true);

    const id = this.editingId();
    const payload = {
      ...this.form,
      precio_hasta: this.form.precio_hasta ?? undefined,
      descripcion: this.form.descripcion || undefined,
      incluye: this.form.incluye || undefined,
    };

    const request$ = id
      ? this.serviceService.update(id, payload)
      : this.serviceService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.reloadServices();
        this.closeForm();
        this.toastService.success(
          id ? 'Servicio actualizado' : 'Servicio creado',
        );
      },
      error: (err) =>
        this.toastService.error(err.error?.error ?? 'Error al guardar'),
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  confirmDelete(id: string): void {
    this.confirmingDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmingDeleteId.set(null);
  }

  delete(id: string): void {
    this.serviceService
      .delete(id)
      .pipe(finalize(() => this.confirmingDeleteId.set(null)))
      .subscribe({
        next: () => {
          this.reloadServices();
          this.toastService.success('Servicio desactivado');
        },
        error: () => this.toastService.error('Error al desactivar el servicio'),
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatPrecio(service: Service): string {
    const base = `$${service.precio.toLocaleString('es-UY')}`;
    return service.precio_hasta
      ? `${base} – $${service.precio_hasta.toLocaleString('es-UY')}`
      : base;
  }
}
