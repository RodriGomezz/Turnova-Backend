import { supabase } from "./supabase.client";
import { Barber } from "../../domain/entities/Barber";
import { AppError } from "../../presentation/middlewares/errorHandler.middleware";

export class BarberRepository {
  private readonly table = "barbers";

  async findById(id: string): Promise<Barber | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Barber;
  }

  async findByBusiness(businessId: string): Promise<Barber[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Barber[];
  }

  async countByBusiness(businessId: string): Promise<number> {
    const { count, error } = await supabase
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("activo", true);

    if (error) throw new AppError(error.message, 500);
    return count ?? 0;
  }

  async create(data: Partial<Barber>): Promise<Barber> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as Barber;
  }

  async update(id: string, data: Partial<Barber>): Promise<Barber> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Barber;
  }

  // Soft delete — marca como inactivo, no elimina físicamente
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .update({ activo: false })
      .eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }
}
