import { supabase } from './supabase.client';
import { User } from '../../domain/entities/User';
import { AppError } from '../../presentation/middlewares/errorHandler.middleware';

export class UserRepository {
  private table = "users";

  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);

    return data as User;
  }

  async findByBusinessId(businessId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);

    return data as User;
  }

  async create(data: Partial<User>): Promise<User> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return created as User;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);

    return updated as User;
  }

  async findBusinessesByUserId(
    userId: string,
  ): Promise<
    { id: string; nombre: string; slug: string; logo_url: string | null }[]
  > {
    const { data, error } = await supabase
      .from("user_businesses")
      .select("businesses(id, nombre, slug, logo_url)")
      .eq("user_id", userId);

    if (error) throw new AppError(error.message, 500);

    return (data ?? []).map((row: any) => row.businesses).filter(Boolean);
  }

  async addBusinessAccess(userId: string, businessId: string): Promise<void> {
    const { error } = await supabase
      .from("user_businesses")
      .insert({ user_id: userId, business_id: businessId, role: "owner" });

    if (error) throw new AppError(error.message, 500);
  }
}