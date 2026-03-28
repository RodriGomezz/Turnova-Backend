import { Subscription, SubscriptionStatus } from "../entities/Subscription";

export interface ISubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByBusinessId(businessId: string): Promise<Subscription | null>;
  findByDlocalId(dlocalSubscriptionId: string): Promise<Subscription | null>;
  /** Suscripciones en grace_period cuya grace_period_ends_at ya venció */
  findExpiredGracePeriods(): Promise<Subscription[]>;
  create(data: Omit<Subscription, "id" | "created_at">): Promise<Subscription>;
  updateStatus(id: string, status: SubscriptionStatus, extra?: Partial<Subscription>): Promise<Subscription>;
}
