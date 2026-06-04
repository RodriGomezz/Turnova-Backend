import { supabase } from "./supabase.client";
import { AppError } from "../../domain/errors";

const TABLE = "barber_services";

export class BarberServiceRepository {

  async findServiceIdsByBarber(barberId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("service_id")
      .eq("barber_id", barberId);

    if (error) throw new AppError(error.message, 500);
    return (data ?? []).map((r) => r.service_id as string);
  }

  // Devuelve Map<barberId, serviceId[]> para cargar en batch sin N+1
  async findServiceIdsByBarbers(
    barberIds: string[],
  ): Promise<Map<string, string[]>> {
    if (barberIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from(TABLE)
      .select("barber_id, service_id")
      .in("barber_id", barberIds);

    if (error) throw new AppError(error.message, 500);

    const map = new Map<string, string[]>();
    for (const row of data ?? []) {
      const bid = row.barber_id as string;
      if (!map.has(bid)) map.set(bid, []);
      map.get(bid)!.push(row.service_id as string);
    }
    return map;
  }

  async add(
    barberId: string,
    serviceId: string,
    businessId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { barber_id: barberId, service_id: serviceId, business_id: businessId },
        { onConflict: "barber_id,service_id", ignoreDuplicates: true },
      );

    if (error) throw new AppError(error.message, 500);
  }

  async remove(barberId: string, serviceId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("barber_id", barberId)
      .eq("service_id", serviceId);

    if (error) throw new AppError(error.message, 500);
  }

  // Elimina todas las relaciones de un barbero — usado al eliminarlo
  async removeAllByBarber(barberId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("barber_id", barberId);

    if (error) throw new AppError(error.message, 500);
  }
}