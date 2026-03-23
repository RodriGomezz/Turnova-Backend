import { supabase } from "./supabase.client";
import { BlockedDate } from "../../domain/entities/BlockedDate";
import { AppError } from "../../presentation/middlewares/errorHandler.middleware";

export class BlockedDateRepository {
  private readonly table = "blocked_dates";

  async findByBusiness(businessId: string): Promise<BlockedDate[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*, barbers(nombre)")
      .eq("business_id", businessId)
      .order("fecha", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as BlockedDate[];
  }

  async isBlocked(
    businessId: string,
    barberId: string,
    fecha: string,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.table)
      .select("id")
      .eq("business_id", businessId)
      .lte("fecha", fecha)
      .gte("fecha_fin", fecha)
      .or(`barber_id.eq.${barberId},barber_id.is.null`);

    if (error) throw new AppError(error.message, 500);
    return (data ?? []).length > 0;
  }

  async create(data: Partial<BlockedDate>): Promise<BlockedDate> {
    const payload = {
      ...data,
      fecha_fin: data.fecha_fin ?? data.fecha,
    };

    const { data: created, error } = await supabase
      .from(this.table)
      .insert(payload)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as BlockedDate;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }
}
