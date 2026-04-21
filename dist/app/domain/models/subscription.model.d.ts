export type SubscriptionPlan = 'starter' | 'pro' | 'business';
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'grace_period' | 'canceled' | 'expired';
export interface Subscription {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    current_period_end: string | null;
    grace_period_ends_at: string | null;
    dlocal_subscription_id: string | null;
}
export interface SubscriptionState {
    subscription: Subscription | null;
    activeSubscription: Subscription | null;
    pendingSubscription: Subscription | null;
}
//# sourceMappingURL=subscription.model.d.ts.map