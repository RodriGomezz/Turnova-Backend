import { Subscription, SubscriptionStatus } from "../entities/Subscription";
export interface ISubscriptionRepository {
    findById(id: string): Promise<Subscription | null>;
    findByBusinessId(businessId: string): Promise<Subscription | null>;
    findActiveByBusinessId(businessId: string): Promise<Subscription | null>;
    findCurrentEffectiveByBusinessId(businessId: string): Promise<Subscription | null>;
    findPendingByBusinessId(businessId: string): Promise<Subscription | null>;
    findByDlocalId(dlocalSubscriptionId: string): Promise<Subscription | null>;
    findByPaymentId(paymentId: string): Promise<Subscription | null>;
    findExpiredGracePeriods(): Promise<Subscription[]>;
    findEndedCanceledSubscriptions(): Promise<Subscription[]>;
    /**
     * Busca la suscripción más reciente cuyo dlocal_subscription_id
     * todavía es el order_id provisional (no empieza con "DP-").
     * Usado como fallback cuando dLocal Go no envía order_id en el webhook.
     */
    findMostRecentPending(): Promise<Subscription | null>;
    create(data: Omit<Subscription, "id" | "created_at">): Promise<Subscription>;
    updateStatus(id: string, status: SubscriptionStatus, extra?: Partial<Subscription>): Promise<Subscription>;
}
//# sourceMappingURL=ISubscriptionRepository.d.ts.map