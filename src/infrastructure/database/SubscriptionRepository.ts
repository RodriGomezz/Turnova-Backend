import { supabase } from "./supabase.client";
import { Subscription, SubscriptionStatus } from "../../domain/entities/Subscription";
import { AppError } from "../../domain/errors";
import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";

export class SubscriptionRepository implements ISubscriptionRepository {
  private readonly table = "subscriptions";

  async findById(id: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*").eq("id", id).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findByBusinessId(businessId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findActiveByBusinessId(businessId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("business_id", businessId)
      .in("status", ["active", "past_due", "grace_period"])
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findCurrentEffectiveByBusinessId(
    businessId: string,
  ): Promise<Subscription | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("business_id", businessId)
      .or(
        `status.in.(active,past_due,grace_period),and(status.eq.canceled,current_period_end.gt.${now})`,
      )
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findPendingByBusinessId(businessId: string): Promise<Subscription | null> {
    const ttl = new Date();
    ttl.setHours(ttl.getHours() - 24);

    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .gte("created_at", ttl.toISOString())
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findByPlanToken(planToken: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("dlocal_plan_token", planToken)
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findBySubscriptionToken(subscriptionToken: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("dlocal_subscription_token", subscriptionToken)
      .single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findByExecutionId(executionId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("dlocal_last_execution_id", executionId)
      .single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
  }

  async findExpiredGracePeriods(): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("status", "grace_period")
      .lt("grace_period_ends_at", new Date().toISOString());
    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Subscription[];
  }

  async findEndedCanceledSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("status", "canceled")
      .not("current_period_end", "is", null)
      .lt("current_period_end", new Date().toISOString());
    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Subscription[];
  }

  async create(data: Omit<Subscription, "id" | "created_at">): Promise<Subscription> {
    const { data: created, error } = await supabase
      .from(this.table).insert(data).select().single();
    if (error) throw new AppError(error.message, 500);
    return created as Subscription;
  }

  async updateStatus(
    id: string,
    status: SubscriptionStatus,
    extra: Partial<Subscription> = {},
  ): Promise<Subscription> {
    const { data: updated, error } = await supabase
      .from(this.table).update({ status, ...extra })
      .eq("id", id).select().single();
    if (error) throw new AppError(error.message, 500);
    return updated as Subscription;
  }
}
