import { supabase } from "./supabase.client";
import { AppError } from "../../domain/errors";
import { Service, ServiceDefault } from "../../domain/entities/Service";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";

export class ServiceRepository implements IServiceRepository {
  private readonly table = "services";

  async findById(id: string): Promise<Service | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116") return null;
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

  /** Devuelve activos e inactivos — para el panel de administración */
  async findAllByBusiness(businessId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .order("activo", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Service[];
  }

  async create(data: Omit<Service, "id" | "activo" | "created_at">): Promise<Service> {
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

  /** Soft delete — marca como inactivo, no elimina físicamente */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .update({ activo: false })
      .eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }

  /** Reactiva un servicio previamente desactivado */
  async reactivate(id: string): Promise<Service> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update({ activo: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Service;
  }

  /** Hard delete — elimina físicamente el servicio de la BD */
  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
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