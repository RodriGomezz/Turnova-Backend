import { supabase } from "./supabase.client";
import { Schedule } from "../../domain/entities/Schedule";
import { AppError } from "../../domain/errors";
import { IScheduleRepository } from "../../domain/interfaces/IScheduleRepository";

export class ScheduleRepository implements IScheduleRepository {
  private readonly table = "schedules";

  async findById(id: string): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Schedule;
  }

  async findForBarber(
    businessId: string,
    barberId: string,
    diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6,
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

  /**
   * Retorna horarios resolviendo precedencia barbero > negocio por día.
   * Sin `barberId` devuelve solo los horarios del negocio.
   */
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

  async create(data: Omit<Schedule, "id">): Promise<Schedule> {
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
}
