import { supabase } from "./supabase.client";
import { Business } from "../../domain/entities/Business";
import { AppError } from "../../presentation/middlewares/errorHandler.middleware";

export class BusinessRepository {
  private readonly table = "businesses";

  async findById(id: string): Promise<Business | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Business;
  }

  // Sin filtro activo — la lógica de negocio decide qué hacer con negocios pausados
  async findBySlug(slug: string): Promise<Business | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("slug", slug)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Business;
  }

  async create(data: Partial<Business>): Promise<Business> {
    console.log("Supabase URL:", process.env.SUPABASE_URL?.slice(0, 30));
    console.log(
      "Using service key:",
      process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20),
    );

    const { data: created, error } = await supabase
      .from("businesses")
      .insert(data)
      .select()
      .single();

    console.log("Insert error:", error);
    console.log("Insert result:", created);

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
}
