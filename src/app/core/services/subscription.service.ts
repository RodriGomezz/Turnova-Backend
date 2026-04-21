import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionState,
} from '../../domain/models/subscription.model';
import { BusinessPlan } from '../../domain/models/business.model';

export interface SubscriptionPayerInput {
  firstName: string;
  lastName: string;
  email: string;
}

// ── Helpers puros ─────────────────────────────────────────────────────────────
export function calcTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil(
    (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export function calcIsPro(plan: BusinessPlan | string, trialEndsAt: string | null): boolean {
  if (plan === 'pro' || plan === 'business') return true;
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) > new Date();
}

export function calcCanUseCustomDomain(
  plan: BusinessPlan | string,
  _trialEndsAt?: string | null,
): boolean {
  return plan === 'pro' || plan === 'business';
}

interface CancelResponse {
  message: string;
  currentPeriodEnd?: string;
}

// ── Servicio ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<Subscription | null> {
    return this.getState().pipe(map((state) => state.activeSubscription));
  }

  getState(): Observable<SubscriptionState> {
    return this.http
      .get<SubscriptionState>(`${this.api}/subscriptions`);
  }

  create(plan: SubscriptionPlan, payer: SubscriptionPayerInput): Observable<string> {
    return this.http
      .post<{ checkoutUrl: string }>(`${this.api}/subscriptions/create`, {
        plan,
        ...payer,
      })
      .pipe(map((res) => res.checkoutUrl));
  }

  cancel(): Observable<CancelResponse> {
    return this.http.delete<CancelResponse>(`${this.api}/subscriptions/cancel`, {
      body: { confirm: true },
    });
  }
}
