import { Injectable, computed, signal, inject } from '@angular/core';
import { BusinessService } from './business.service';
import { SubscriptionService } from './subscription.service';
import { forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Business } from '../../domain/models/business.model';
import { Subscription } from '../../domain/models/subscription.model';

export type PlanStatus =
  | 'trial_active'
  | 'trial_grace'
  | 'trial_expired'
  | 'starter'
  | 'pro_active'
  | 'business_active'
  | 'payment_pending'
  | 'payment_grace';

const TRIAL_GRACE_DAYS = 14;

@Injectable({ providedIn: 'root' })
export class BusinessStatusService {
  private readonly businessService     = inject(BusinessService);
  private readonly subscriptionService = inject(SubscriptionService);

  readonly business     = signal<Business | null>(null);
  readonly subscription = signal<Subscription | null>(null);
  readonly loaded       = signal(false);

  readonly planStatus = computed((): PlanStatus => {
    const b = this.business();
    const s = this.subscription();
    if (!b) return 'starter';

    const now = Date.now();
    const trialEnd = b.trial_ends_at ? new Date(b.trial_ends_at).getTime() : null;

    // Suscripción activa — tiene máxima prioridad, ignora trial
    if (s?.status === 'active') {
      if (b.plan === 'pro')      return 'pro_active';
      if (b.plan === 'business') return 'business_active';
      return 'starter'; // suscripción activa a Starter
    }

    if (s?.status === 'past_due')     return 'payment_pending';
    if (s?.status === 'grace_period') return 'payment_grace';

    // Sin suscripción activa — evaluar trial
    if (trialEnd && trialEnd > now) return 'trial_active';

    if (trialEnd && trialEnd <= now) {
      const daysSinceExpiry = (now - trialEnd) / (1000 * 60 * 60 * 24);
      if (daysSinceExpiry <= TRIAL_GRACE_DAYS) return 'trial_grace';
      return 'trial_expired';
    }

    return 'starter';
  });

  readonly isPro = computed(() => {
    const status = this.planStatus();
    return (
      status === 'trial_active'    ||
      status === 'trial_grace'     ||
      status === 'pro_active'      ||
      status === 'business_active'
    );
  });

  readonly isBusiness = computed(() => this.planStatus() === 'business_active');

  readonly trialDaysLeft = computed(() => {
    const b = this.business();
    if (!b?.trial_ends_at) return null;
    const days = Math.ceil(
      (new Date(b.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return days > 0 ? days : null;
  });

  readonly trialGraceDaysLeft = computed(() => {
    const b = this.business();
    if (!b?.trial_ends_at) return null;
    const trialEnd = new Date(b.trial_ends_at).getTime();
    const graceEnd = trialEnd + TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const days = Math.ceil((graceEnd - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  });

  /**
   * Banner informativo — solo se muestra si no hay suscripción activa
   * o si hay un problema de pago.
   */
  readonly bannerInfo = computed((): { type: 'info' | 'warning' | 'danger' | null; message: string } => {
    const status   = this.planStatus();
    const trialLeft = this.trialDaysLeft();
    const graceLeft = this.trialGraceDaysLeft();

    switch (status) {
      case 'pro_active':
      case 'business_active':
      case 'starter':
        // Suscripción activa o Starter sin trial — sin banner
        return { type: null, message: '' };

      case 'trial_active':
        if (trialLeft !== null && trialLeft <= 7) {
          return { type: 'warning', message: `Tu período de prueba vence en ${trialLeft} día${trialLeft !== 1 ? 's' : ''}. Suscribite para no perder el acceso Pro.` };
        }
        return { type: 'info', message: `Trial activo — ${trialLeft} días restantes con acceso Pro completo.` };

      case 'trial_grace':
        return { type: 'warning', message: `Tu trial venció. Tenés ${graceLeft} día${graceLeft !== 1 ? 's' : ''} antes de bajar a Starter. Suscribite ahora.` };

      case 'trial_expired':
        return { type: 'danger', message: 'Tu período de prueba venció. Suscribite para recuperar todas las funcionalidades.' };

      case 'payment_pending':
        return { type: 'warning', message: 'Tuvimos un problema con tu pago. Lo estamos reintentando automáticamente.' };

      case 'payment_grace':
        return { type: 'danger', message: 'Los reintentos de pago se agotaron. Actualizá tu método de pago antes de perder el acceso Pro.' };

      default:
        return { type: null, message: '' };
    }
  });

  load() {
    return forkJoin({
      business:     this.businessService.get(),
      subscription: this.subscriptionService.get(),
    }).pipe(
      tap(({ business, subscription }) => {
        this.business.set(business);
        this.subscription.set(subscription);
        this.loaded.set(true);
      }),
    );
  }

  refresh() {
    this.loaded.set(false);
    return this.load();
  }
}
