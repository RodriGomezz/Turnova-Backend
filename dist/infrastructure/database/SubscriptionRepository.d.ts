import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
export declare class SubscriptionRepository implements ISubscriptionRepository {
    private readonly table;
    findById(id: string): Promise<Subscription | null>;
    findByBusinessId(businessId: string): Promise<Subscription | null>;
    findActiveByBusinessId(businessId: string): Promise<Subscription | null>;
    findCurrentEffectiveByBusinessId(businessId: string): Promise<Subscription | null>;
    findPendingByBusinessId(businessId: string): Promise<Subscription | null>;
    findByDlocalId(dlocalSubscriptionId: string): Promise<Subscription | null>;
    findByPaymentId(paymentId: string): Promise<Subscription | null>;
    findExpiredGracePeriods(): Promise<Subscription[]>;
    findEndedCanceledSubscriptions(): Promise<Subscription[]>;
    findMostRecentPending(businessId?: string): Promise<Subscription | null>;
    create(data: Omit<Subscription, "id" | "created_at">): Promise<Subscription>;
    updateStatus(id: string, status: SubscriptionStatus, extra?: Partial<Subscription>): Promise<Subscription>;
}
//# sourceMappingURL=SubscriptionRepository.d.ts.map