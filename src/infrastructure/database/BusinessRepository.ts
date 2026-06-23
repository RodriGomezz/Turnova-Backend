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

  /**
   * Hostnames de todos los dominios propios verificados.
   * Usado por el server SSR para construir allowedHosts dinámico —
   * sin esto, Angular bloquea por SSRF cualquier dominio custom no
   * listado de antemano (angular.json solo cubre *.kronu.pro).
   * Sin datos sensibles: son los mismos hostnames que cualquiera ve
   * visitando el sitio del negocio.
   */
  async findAllVerifiedDomains(): Promise<string[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("custom_domain")
      .eq("domain_verified", true)
      .not("custom_domain", "is", null);

    if (error) throw new AppError(error.message, 500);
    return (data ?? [])
      .map((row) => row.custom_domain as string | null)
      .filter((domain): domain is string => !!domain);
  }

  /**
   * Slugs de negocios activos para el sitemap dinámico (kronu.pro/sitemap.xml
   * y el sitemap propio de cada negocio). Solo `activo = true` — un negocio
   * pausado no debería seguir indexado mientras esté desactivado.
   * Sin datos sensibles: slug y created_at son públicos (la URL del negocio
   * ya expone el slug).
   */
  async findAllActiveSlugs(): Promise<{ slug: string; createdAt: string }[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("slug, created_at")
      .eq("activo", true);

    if (error) throw new AppError(error.message, 500);
    return (data ?? []).map((row) => ({
      slug: row.slug as string,
      createdAt: row.created_at as string,
    }));
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
