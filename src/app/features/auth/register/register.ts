// register.ts
import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TIPOS_NEGOCIO, TipoNegocio } from '../../../core/models/tipo-negocio';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  nombre = '';
  nombreNegocio = '';
  slug = '';
  email = '';
  password = '';
  tipoNegocioValue = '';

  readonly tiposNegocio = TIPOS_NEGOCIO;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly showPassword = signal(false);
  readonly isExiting = signal(false);

  // ── Slug ───────────────────────────────────────────────────────────────────

  generateSlug(): void {
    this.slug = this.nombreNegocio
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  sanitizeSlug(): void {
    this.slug = this.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get tipoSeleccionado(): TipoNegocio | undefined {
    return this.tiposNegocio.find((t) => t.value === this.tipoNegocioValue);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  goToLogin(): void {
    this.isExiting.set(true);
    setTimeout(() => this.router.navigate(['/login']), 280);
  }

  // ── Register ───────────────────────────────────────────────────────────────

  onRegister(): void {
    if (
      !this.nombre ||
      !this.email ||
      !this.password ||
      !this.nombreNegocio ||
      !this.slug
    ) {
      this.error.set('Completá todos los campos');
      return;
    }
    if (!this.tipoNegocioValue) {
      this.error.set('Seleccioná el tipo de negocio');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const tipo = this.tipoSeleccionado;
    this.loading.set(true);
    this.error.set(null);

    this.authService
      .register({
        nombre: this.nombre,
        email: this.email,
        password: this.password,
        nombre_negocio: this.nombreNegocio,
        slug: this.slug,
        tipo_negocio: tipo?.value,
        termino_profesional: tipo?.termino_profesional,
        termino_profesional_plural: tipo?.termino_profesional_plural,
        termino_servicio: tipo?.termino_servicio,
        termino_reserva: tipo?.termino_reserva,
      })
      .pipe(
        switchMap(() => this.authService.login(this.email, this.password)),
        switchMap(() => this.authService.me()),
      )
      .subscribe({
        next: () => {
          this.success.set(true);
          setTimeout(() => this.router.navigate(['/panel']), 800);
        },
        error: (err) => {
          this.loading.set(false);
          const msg = err.error?.error ?? '';
          if (msg.includes('slug')) {
            this.error.set('Ese link ya está en uso. Probá con otro.');
          } else if (msg.includes('email')) {
            this.error.set('Ese email ya tiene una cuenta.');
          } else {
            this.error.set('Error al crear la cuenta. Intentá de nuevo.');
          }
        },
      });
  }
}
