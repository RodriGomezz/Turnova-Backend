import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  password = '';
  passwordConfirm = '';
  accessToken = '';

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  showPassword = signal(false);
  invalidToken = signal(false);

  ngOnInit(): void {
    // Supabase redirige con el token en el fragment de la URL
    // Ej: /reset-password#access_token=xxx&type=recovery
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const token = params.get('access_token');
    const type = params.get('type');

    if (!token || type !== 'recovery') {
      this.invalidToken.set(true);
      return;
    }

    this.accessToken = token;
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    if (!this.password) {
      this.error.set('Ingresá una contraseña');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.password !== this.passwordConfirm) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .resetPassword(this.accessToken, this.password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.success.set(true);
          setTimeout(() => this.router.navigate(['/login']), 2500);
        },
        error: (err) => {
          this.error.set(
            err.status === 401
              ? 'El link expiró o ya fue usado. Solicitá uno nuevo.'
              : 'Error al actualizar la contraseña. Intentá de nuevo.',
          );
        },
      });
  }
}
