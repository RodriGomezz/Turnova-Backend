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

  async findByDlocalId(dlocalSubscriptionId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .eq("dlocal_subscription_id", dlocalSubscriptionId)
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

  /**
   * Busca la suscripción más reciente con dlocal_subscription_id provisional
   * (el order_id que generamos: uuid_timestamp, no empieza con "DP-")
   */
  async findMostRecentPending(): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from(this.table).select("*")
      .not("dlocal_subscription_id", "like", "DP-%")
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Subscription;
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
