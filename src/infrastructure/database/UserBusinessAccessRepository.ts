import { supabase } from "./supabase.client";
import { AppError } from "../../domain/errors";
import {
  IUserBusinessAccess,
  UserBusinessSummary,
} from "../../domain/interfaces/IUserBusinessAccess";

/**
 * Supabase infiere joins como array aunque sea una FK many-to-one.
 * Tipamos businesses como array para reflejar lo que realmente devuelve el cliente.
 */
interface BusinessFields {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  activo: boolean;
  plan: string;
  created_at: string;
}

interface UserBusinessRow {
  business_id: string;
  created_at: string;
  businesses: BusinessFields[] | null;
}

export class UserBusinessAccessRepository implements IUserBusinessAccess {
  private readonly table = "user_businesses";

  async hasAccess(userId: string, businessId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.table)
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .single();

    if (error?.code === "PGRST116") return false;
    if (error) throw new AppError(error.message, 500);
    return !!data;
  }

  async findByUser(userId: string): Promise<UserBusinessSummary[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select(
        "business_id, created_at, businesses(id, nombre, slug, logo_url, activo, plan, created_at)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);

    const rows = (data ?? []) as UserBusinessRow[];

    return rows
      .map((row, index) => {
        // Supabase devuelve array para joins — tomamos el primer elemento
        const business = Array.isArray(row.businesses)
          ? row.businesses[0]
          : row.businesses;

        if (!business) return null;

        return {
          ...business,
          esPrincipal: index === 0,
        } satisfies UserBusinessSummary;
      })
      .filter((b): b is UserBusinessSummary => b !== null);
  }

  async findPrincipalBusinessId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("business_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);

    const row = data as { business_id: string } | null;
    return row?.business_id ?? null;
  }
}
