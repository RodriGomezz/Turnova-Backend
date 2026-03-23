import { supabase } from "./supabase.client";
import { Schedule } from "../../domain/entities/Schedule";
import { AppError } from "../../presentation/middlewares/errorHandler.middleware";

export class ScheduleRepository {
  private readonly table = "schedules";

  async findByBusiness(businessId: string): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .eq("activo", true)
      .order("dia_semana", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Schedule[];
  }

  async findForBarber(
    businessId: string,
    barberId: string,
    diaSemana: number,
  ): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .eq("dia_semana", diaSemana)
      .eq("activo", true);

    if (error) throw new AppError(error.message, 500);
    if (!data || data.length === 0) return null;

    const barberSchedule = data.find((s) => s.barber_id === barberId) ?? null;
    const businessSchedule = data.find((s) => s.barber_id === null) ?? null;

    return (barberSchedule ?? businessSchedule) as Schedule | null;
  }

  // Retorna horarios resolviendo la precedencia barbero > negocio por día.
  // Si se pasa barberId, para cada día usa el horario del barbero si existe,
  // sino el del negocio. Sin barberId, retorna solo los horarios del negocio.
  async findAllByBusiness(
    businessId: string,
    barberId?: string,
  ): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .eq("activo", true);

    if (error) throw new AppError(error.message, 500);

    const schedules = (data ?? []) as Schedule[];

    if (!barberId) {
      return schedules.filter((s) => s.barber_id === null);
    }

    const byDay = new Map<number, Schedule>();
    for (const s of schedules) {
      const existing = byDay.get(s.dia_semana);
      if (!existing || s.barber_id === barberId) {
        byDay.set(s.dia_semana, s);
      }
    }
    return Array.from(byDay.values());
  }

  async create(data: Partial<Schedule>): Promise<Schedule> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as Schedule;
  }

  async update(id: string, data: Partial<Schedule>): Promise<Schedule> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Schedule;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }

  // ScheduleRepository — agregar este método
  async findById(id: string): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Schedule;
  }
}
