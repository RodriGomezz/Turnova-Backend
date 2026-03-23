import { supabase } from "./supabase.client";
import { AppError } from "../../presentation/middlewares/errorHandler.middleware";
import { Service, ServiceDefault } from "../../domain/entities/Service";

export class ServiceRepository {
  private readonly table = "services";

  async findById(id: string): Promise<Service | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Service;
  }

  async findByBusiness(businessId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .eq("activo", true)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Service[];
  }

  async create(data: Partial<Service>): Promise<Service> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as Service;
  }

  async update(id: string, data: Partial<Service>): Promise<Service> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Service;
  }

  // Soft delete — marca como inactivo, no elimina físicamente
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .update({ activo: false })
      .eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }

  async listDefaults(tipoNegocio?: string): Promise<ServiceDefault[]> {
    let query = supabase
      .from("services_defaults")
      .select("*")
      .order("precio_sugerido", { ascending: true });

    if (tipoNegocio) {
      query = query.eq("tipo_negocio", tipoNegocio);
    }

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as ServiceDefault[];
  }
}
