import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);

  email = '';
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  onSubmit(): void {
    if (!this.email.trim()) {
      this.error.set('Ingresá tu email');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .requestPasswordReset(this.email.trim())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.success.set(true),
        error: () =>
          this.error.set('Error al enviar el email. Intentá de nuevo.'),
      });
  }
}
