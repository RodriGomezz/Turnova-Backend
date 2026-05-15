import { supabase } from "./supabase.client";
import { AppError } from "../../domain/errors";
import { Business } from "../../domain/entities/Business";

interface UserBusinessRow {
  user_id: string;
  business_id: string;
}

export async function findNetworkBusinessIds(
  seedBusinessId: string,
): Promise<string[]> {
  const { data: ownerRow, error: ownerError } = await supabase
    .from("user_businesses")
    .select("user_id")
    .eq("business_id", seedBusinessId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (ownerError?.code === "PGRST116") return [seedBusinessId];
  if (ownerError) throw new AppError(ownerError.message, 500);

  const userId = (ownerRow as { user_id: string }).user_id;

  const { data: rows, error } = await supabase
    .from("user_businesses")
    .select("business_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new AppError(error.message, 500);

  const businessIds = ((rows ?? []) as UserBusinessRow[]).map((row) => row.business_id);
  return businessIds.length > 0 ? [...new Set(businessIds)] : [seedBusinessId];
}

export async function updateBusinessNetwork(
  seedBusinessId: string,
  data: Partial<Business>,
): Promise<string[]> {
  const businessIds = await findNetworkBusinessIds(seedBusinessId);

  for (const businessId of businessIds) {
    const { error } = await supabase
      .from("businesses")
      .update(data)
      .eq("id", businessId);

    if (error) throw new AppError(error.message, 500);
  }

  return businessIds;
}
