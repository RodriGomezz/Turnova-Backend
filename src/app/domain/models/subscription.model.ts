// src/app/domain/models/subscription.model.ts
// Actualizar para que coincida con lo que devuelve la view

export type SubscriptionPlan = 'starter' | 'pro' | 'business';

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'canceled'
  | 'expired';

export interface Subscription {
  plan:                   SubscriptionPlan;
  status:                 SubscriptionStatus;
  current_period_end:     string | null;   // ISO date — fin del período pagado
  grace_period_ends_at:   string | null;   // ISO date — fin del grace period
  dlocal_subscription_id: string | null;
}

export interface SubscriptionState {
  subscription: Subscription | null;
  activeSubscription: Subscription | null;
  pendingSubscription: Subscription | null;
}
