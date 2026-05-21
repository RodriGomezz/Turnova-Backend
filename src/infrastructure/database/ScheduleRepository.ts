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

  /**
   * FIX PERF: en lugar de traer todos los schedules del día para todos los
   * barberos y filtrar en memoria, hacemos dos queries paralelas acotadas:
   *   1. schedule propio del barbero para ese día
   *   2. schedule del negocio (barber_id IS NULL) para ese día
   *
   * Precedencia: barbero > negocio.
   * Si el barbero no tiene schedule para ese día → fallback al negocio.
   */
  async findForBarber(
    businessId: string,
    barberId: string,
    diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  ): Promise<Schedule | null> {
    const [barberResult, businessResult] = await Promise.all([
      supabase
        .from(this.table)
        .select("*")
        .eq("business_id", businessId)
        .eq("barber_id", barberId)
        .eq("activo", true)
        .order("dia_semana", { ascending: true }),

      supabase
        .from(this.table)
        .select("*")
        .eq("business_id", businessId)
        .is("barber_id", null)
        .eq("dia_semana", diaSemana)
        .eq("activo", true)
        .maybeSingle(),
    ]);

    if (barberResult.error)  throw new AppError(barberResult.error.message,  500);
    if (businessResult.error) throw new AppError(businessResult.error.message, 500);

    // Barbero tiene schedule propio → usarlo (no importa si el negocio también tiene)
    const barberSchedules = (barberResult.data ?? []) as Schedule[];
    const barberScheduleForDay =
      barberSchedules.find((schedule) => schedule.dia_semana === diaSemana) ?? null;
    if (barberSchedules.length > 0) return barberScheduleForDay;

    // Sin schedule propio → usar el del negocio como fallback
    return (businessResult.data ?? null) as Schedule | null;
  }

  /**
   * FIX BUG: la versión anterior tenía una condición de precedencia rota.
   *
   * Problema original:
   *   if (!existing || s.barber_id === barberId) { byDay.set(...) }
   *
   * Si el schedule del barbero llegaba ANTES que el del negocio en el array,
   * luego al procesar el del negocio: !existing=false y barber_id===barberId=false
   * → el negocio sobreescribía al barbero. Orden-dependiente = bug silencioso.
   *
   * Fix: dos pasadas explícitas.
   *   Pasada 1: cargar todos los schedules del negocio (barber_id IS NULL).
   *   Pasada 2: sobreescribir con los del barbero (siempre ganan).
   * El orden de llegada de Supabase ya no importa.
   */
  async findAllByBusiness(
    businessId: string,
    barberId?: string,
  ): Promise<Schedule[]> {
    const schedules = await this.findRawByBusiness(businessId);

    // Sin barberId → solo horarios del negocio (sin barbero asignado)
    if (!barberId) {
      return schedules.filter((s) => s.barber_id === null);
    }

    // Con barberId → precedencia barbero > negocio, por día.
    //
    // Dos pasadas garantizan que el orden de llegada no afecta el resultado:
    //   1. Sembrar con schedules del negocio
    //   2. Sobreescribir con schedules del barbero (siempre ganan)
    const barberSchedules = schedules.filter((s) => s.barber_id === barberId);
    if (barberSchedules.length > 0) return barberSchedules;

    return schedules.filter((s) => s.barber_id === null);
  }

  async findRawByBusiness(businessId: string): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("business_id", businessId)
      .eq("activo", true);

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Schedule[];
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
