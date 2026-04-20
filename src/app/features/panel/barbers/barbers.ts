import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { BarberService } from '../../../core/services/barber.service';
import { StorageService } from '../../../core/services/storage.service';
import { BusinessService } from '../../../core/services/business.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { Barber } from '../../../domain/models/barber.model';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE_MB = 2;

interface BarberForm {
  nombre: string;
  descripcion: string;
  orden: number;
}

@Component({
  selector: 'app-barbers',
  standalone: true,
  imports: [FormsModule, LowerCasePipe, RouterLink],
  templateUrl: './barbers.html',
  styleUrl: './barbers.scss',
})
export class Barbers implements OnInit {
  private readonly barberService = inject(BarberService);
  private readonly storageService = inject(StorageService);
  private readonly businessService = inject(BusinessService);
  private readonly toastService = inject(ToastService);
  readonly terms = inject(TerminologyService);

  readonly barbers = signal<Barber[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly uploadingId = signal<string | null>(null);
  readonly confirmingDeleteId = signal<string | null>(null);
  readonly excedeLimit = signal(false);
  readonly maxBarberos = signal(1);
  readonly totalBarberos = signal(0);

  form: BarberForm = { nombre: '', descripcion: '', orden: 0 };

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadInitial();
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  private loadInitial(): void {
    this.loading.set(true);

    forkJoin({
      barbers: this.barberService.list(),
      status: this.businessService.getStatus(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ barbers, status }) => {
          this.barbers.set(barbers);
          this.excedeLimit.set(status.excedeLimit);
          this.maxBarberos.set(status.maxBarberos);
          this.totalBarberos.set(status.totalBarberos);
        },
        error: () =>
          this.toastService.error('Error al cargar los profesionales'),
      });
  }

  private reloadBarbers(): void {
    this.barberService.list().subscribe({
      next: (barbers) => this.barbers.set(barbers),
      error: () => this.toastService.error('Error al actualizar la lista'),
    });
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.editingId.set(null);
    this.form = { nombre: '', descripcion: '', orden: this.barbers().length };
    this.showForm.set(true);
  }

  openEdit(barber: Barber): void {
    this.editingId.set(barber.id);
    this.form = {
      nombre: barber.nombre,
      descripcion: barber.descripcion ?? '',
      orden: barber.orden,
    };
    this.showForm.set(true);
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

    this.saving.set(true);
    const id = this.editingId();
    const term = this.terms.profesional();
    const request$ = id
      ? this.barberService.update(id, this.form)
      : this.barberService.create(this.form);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.reloadBarbers();
        this.closeForm();
        this.toastService.success(
          id ? `${term} actualizado` : `${term} creado`,
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
    this.barberService
      .delete(id)
      .pipe(finalize(() => this.confirmingDeleteId.set(null)))
      .subscribe({
        next: () => {
          this.reloadBarbers();
          this.toastService.success(`${this.terms.profesional()} desactivado`);
        },
        error: () =>
          this.toastService.error(
            `Error al desactivar el ${this.terms.profesional().toLowerCase()}`,
          ),
      });
  }

  // ── Photo ──────────────────────────────────────────────────────────────────

  onPhotoSelected(event: Event, barberId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      this.toastService.error('Solo se permiten imágenes JPG, PNG o WEBP');
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      this.toastService.error(
        `La imagen no puede superar ${MAX_PHOTO_SIZE_MB}MB`,
      );
      return;
    }

    this.uploadingId.set(barberId);

    this.storageService.uploadBarberPhoto(file, barberId).subscribe({
      next: (url) => {
        this.barberService.update(barberId, { foto_url: url }).subscribe({
          next: () => {
            this.reloadBarbers();
            this.uploadingId.set(null);
          },
          error: () => {
            this.toastService.error('Error al guardar la foto');
            this.uploadingId.set(null);
          },
        });
      },
      error: () => {
        this.toastService.error('Error al subir la foto');
        this.uploadingId.set(null);
      },
    });
  }
}
