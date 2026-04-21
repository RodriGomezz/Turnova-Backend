// login.ts
import { Component, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly isExiting = signal(false);

  onLogin(): void {
    if (!this.email || !this.password) {
      this.error.set('Completá todos los campos');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .login(this.email, this.password)
      .pipe(switchMap(() => this.authService.me()))
      .subscribe({
        next: () => this.router.navigate(['/panel']),
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err.status === 401
              ? 'Email o contraseña incorrectos'
              : 'Error al ingresar. Intentá de nuevo.',
          );
        },
      });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  goToRegister(): void {
    this.isExiting.set(true);
    setTimeout(() => this.router.navigate(['/registro']), 280);
  }
}
