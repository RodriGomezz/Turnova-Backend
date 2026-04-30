import { Subscription, SubscriptionStatus } from "../entities/Subscription";

export interface ISubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByBusinessId(businessId: string): Promise<Subscription | null>;
  findActiveByBusinessId(businessId: string): Promise<Subscription | null>;
  findCurrentEffectiveByBusinessId(businessId: string): Promise<Subscription | null>;
  findPendingByBusinessId(businessId: string): Promise<Subscription | null>;

  /** Busca por plan_token de dLocal Go (para vincular el webhook de confirmación) */
  findByPlanToken(planToken: string): Promise<Subscription | null>;
  /** Busca por subscription_token de dLocal Go */
  findBySubscriptionToken(subscriptionToken: string): Promise<Subscription | null>;
  /** Busca por ID de ejecución (order_id del cobro) */
  findByExecutionId(executionId: string): Promise<Subscription | null>;

  findExpiredGracePeriods(): Promise<Subscription[]>;
  findEndedCanceledSubscriptions(): Promise<Subscription[]>;

  create(data: Omit<Subscription, "id" | "created_at">): Promise<Subscription>;
  updateStatus(
    id: string,
    status: SubscriptionStatus,
    extra?: Partial<Subscription>,
  ): Promise<Subscription>;
}
