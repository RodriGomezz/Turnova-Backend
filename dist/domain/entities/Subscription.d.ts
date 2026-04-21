export type SubscriptionStatus = "pending" | "active" | "past_due" | "grace_period" | "canceled" | "expired";
export type SubscriptionPlan = "starter" | "pro" | "business";
export interface Subscription {
    id: string;
    business_id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    /** ID de la suscripción en dLocal Go */
    dlocal_subscription_id: string;
    /** ID del último pago procesado */
    dlocal_payment_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    /** current_period_end + GRACE_PERIOD_DAYS. Null si status no es grace_period */
    grace_period_ends_at: string | null;
    canceled_at: string | null;
    created_at: string;
}
//# sourceMappingURL=Subscription.d.ts.map