import { supabase } from "./supabase.client";
import { Business } from "../../domain/entities/Business";
import { AppError } from "../../domain/errors";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";

export class BusinessRepository implements IBusinessRepository {
  private readonly table = "businesses";

  async findById(id: string): Promise<Business | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Business;
  }

  /** Sin filtro `activo` — la capa de aplicación decide qué hacer con negocios pausados */
  async findBySlug(slug: string): Promise<Business | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("slug", normalizedSlug)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Business;
  }

  async findByCustomDomain(domain: string): Promise<Business | null> {
    const normalizedDomain = domain.trim().toLowerCase();
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("custom_domain", normalizedDomain)
      .eq("domain_verified", true)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Business;
  }

  async findByAnyCustomDomain(domain: string): Promise<Business | null> {
    const normalizedDomain = domain.trim().toLowerCase();
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("custom_domain", normalizedDomain)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Business;
  }

  async create(
    data: Omit<Business, "id" | "created_at" | "domain_verified" | "domain_verified_at" | "domain_added_at" | "onboarding_completed">,
  ): Promise<Business> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as Business;
  }

  async update(id: string, data: Partial<Business>): Promise<Business> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Business;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }
}
