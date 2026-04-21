import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SeoService } from '../../core/services/seo.service';

type BusinessType =
  | ''
  | 'Barberia'
  | 'Peluqueria'
  | 'Spa / Centro estetico'
  | 'Consultorio medico'
  | 'Otro';

type FounderResponse =
  | { status: 'ok'; count: number }
  | { status: 'duplicate' }
  | { status: string; count?: number };

@Component({
  selector: 'app-preventa-fundadores',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './preventa-fundadores.html',
  styleUrl: './preventa-fundadores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreventaFundadores implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly seo = inject(SeoService);
  private readonly appsScriptUrl = environment.founderWaitlistUrl;
  private readonly totalSpots = environment.founderSpots;

  protected readonly businessName = signal('');
  protected readonly businessType = signal<BusinessType>('');
  protected readonly email = signal('');
  protected readonly currentCount = signal<number | null>(null);
  protected readonly loadingCount = signal(true);
  protected readonly countLoadError = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly duplicateEmail = signal('');
  protected readonly successPosition = signal<number | null>(null);
  protected readonly state = signal<'form' | 'success' | 'duplicate'>('form');

  protected readonly businessTypes: Exclude<BusinessType, ''>[] = [
    'Barberia',
    'Peluqueria',
    'Spa / Centro estetico',
    'Consultorio medico',
    'Otro',
  ];

  protected readonly progressPercent = computed(() =>
    Math.min((((this.currentCount() ?? 0) / this.totalSpots) * 100), 100),
  );

  protected readonly remainingSpots = computed(() =>
    Math.max(this.totalSpots - (this.currentCount() ?? 0), 0),
  );

  ngOnInit(): void {
    this.seo.setPageMeta({
      title: 'Kronu | Precio fundador',
      description:
        'Reserva uno de los 100 lugares fundadores de Kronu y bloquea tu precio especial antes del lanzamiento.',
      path: '/fundadores',
    });
    void this.loadCount();
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    const businessName = this.businessName().trim();
    const businessType = this.businessType().trim();
    const email = this.email().trim().toLowerCase();

    if (!businessName || !businessType || !email) {
      this.submitError.set('Completa nombre del negocio, rubro y email para reservar tu lugar.');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.submitError.set('Ingresa un email valido para que podamos avisarte del lanzamiento.');
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');

    try {
      const payload = new FormData();
      payload.append('nombre', businessName);
      payload.append('tipo', businessType);
      payload.append('email', email);
      payload.append('fecha', new Date().toISOString());

      const response = await firstValueFrom(
        this.http.post<FounderResponse>(this.appsScriptUrl, payload),
      );

      if (response.status === 'ok') {
        this.state.set('success');
        if (response.count != null) {
          this.currentCount.set(response.count);
          this.countLoadError.set(false);
          this.successPosition.set(response.count);
        } else {
          const freshCount = await this.loadCount();
          if (freshCount != null) {
            this.successPosition.set(freshCount);
          }
        }
        return;
      }

      if (response.status === 'duplicate') {
        this.duplicateEmail.set(email);
        this.state.set('duplicate');
        return;
      }

      this.submitError.set('No pudimos guardar tu lugar ahora mismo. Intenta de nuevo en unos segundos.');
    } catch {
      this.submitError.set('No pudimos conectar con la lista de fundadores. Intenta de nuevo en unos segundos.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected resetForm(): void {
    this.businessName.set('');
    this.businessType.set('');
    this.email.set('');
    this.submitError.set('');
    this.duplicateEmail.set('');
    this.successPosition.set(null);
    this.state.set('form');
  }

  private async loadCount(): Promise<number | null> {
    this.countLoadError.set(false);

    try {
      const response = await firstValueFrom(
        this.http.get<{ count: number }>(`${this.appsScriptUrl}?action=count`),
      );
      const count = response.count ?? null;

      if (count == null) {
        this.currentCount.set(null);
        this.countLoadError.set(true);
        return null;
      }

      this.currentCount.set(count);
      return count;
    } catch {
      this.currentCount.set(null);
      this.countLoadError.set(true);
      return null;
    } finally {
      this.loadingCount.set(false);
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
