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
   * Retorna el schedule efectivo para un barbero en un día dado.
   *
   * Semántica (opt-in explícito):
   *   - Barbero SIN schedules propios → nunca fue configurado → hereda el negocio.
   *   - Barbero CON schedules propios → trabaja SOLO esos días; sin fallback al negocio.
   *
   * Un barbero con Lun+Jue configurados NO trabaja Mar aunque el negocio sí lo haga.
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
        .eq("activo", true),

      supabase
        .from(this.table)
        .select("*")
        .eq("business_id", businessId)
        .is("barber_id", null)
        .eq("dia_semana", diaSemana)
        .eq("activo", true)
        .maybeSingle(),
    ]);

    if (barberResult.error)   throw new AppError(barberResult.error.message, 500);
    if (businessResult.error) throw new AppError(businessResult.error.message, 500);

    const barberSchedules = (barberResult.data ?? []) as Schedule[];
    const hasOwnSchedules  = barberSchedules.length > 0;

    if (hasOwnSchedules) {
      // Configurado: solo trabaja los días que activó. Si no activó este día → null.
      return barberSchedules.find((s) => s.dia_semana === diaSemana) ?? null;
    }

    // Sin configuración propia → hereda el horario del negocio para este día.
    return (businessResult.data ?? null) as Schedule | null;
  }

  /**
   * Retorna los schedules efectivos del mes completo para un barbero.
   *
   * Misma semántica que findForBarber:
   *   - Barbero SIN schedules propios → hereda TODOS los días del negocio.
   *   - Barbero CON schedules propios → devuelve SOLO sus días. Sin relleno.
   *
   * Usado por GetAvailableDaysUseCase y GetAllSlotsForDaysUseCase para calcular
   * el calendario completo en memoria (evita N queries por día).
   */
  async findAllByBusiness(
    businessId: string,
    barberId?: string,
  ): Promise<Schedule[]> {
    const schedules = await this.findRawByBusiness(businessId);

    if (!barberId) {
      return schedules.filter((s) => s.barber_id === null);
    }

    const barberSchedules   = schedules.filter((s) => s.barber_id === barberId);
    const businessSchedules = schedules.filter((s) => s.barber_id === null);

    if (barberSchedules.length > 0) {
      // Barbero configurado → solo sus días, sin heredar días del negocio.
      return barberSchedules;
    }

    // Sin configuración propia → hereda todo el negocio.
    return businessSchedules;
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
