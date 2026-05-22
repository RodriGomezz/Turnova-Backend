import { supabase } from "./supabase.client";
import { Booking, BookingEstado } from "../../domain/entities/Booking";
import { AppError, ConflictError } from "../../domain/errors";
import {
  IBookingRepository,
  BookingsByMonth,
} from "../../domain/interfaces/IBookingRepository";

export class BookingRepository implements IBookingRepository {
  private readonly table = "bookings";

  async findById(id: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Booking;
  }

  async findByCancellationToken(token: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("cancellation_token", token)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Booking;
  }

  async findByBusinessAndDate(businessId: string, fecha: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select(
        "*, barbers(nombre), services(nombre, duracion_minutos, precio, precio_hasta)",
      )
      .eq("business_id", businessId)
      .eq("fecha", fecha)
      .neq("estado", "cancelada")
      .order("hora_inicio", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Booking[];
  }

  async findByBusinessAndMonth(
  businessId: string,
  year: number,
  month: number,
): Promise<Booking[]> {
  const { from, to } = this.buildMonthRange(year, month);

  const { data, error } = await supabase
    .from(this.table)
    .select('*, barbers(nombre), services(nombre, duracion_minutos, precio, precio_hasta)')
    .eq('business_id', businessId)
    .neq('estado', 'cancelada')
    .gte('fecha', from)
    .lte('fecha', to)
    .order('fecha',       { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) throw new AppError(error.message, 500);
  return (data ?? []) as Booking[];
}

  async findByBarberAndDate(barberId: string, fecha: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("barber_id", barberId)
      .eq("fecha", fecha)
      .neq("estado", "cancelada");

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Booking[];
  }

  async findByBarberAndMonth(
    barberId: string,
    businessId: string,
    from: string,
    to: string,
  ): Promise<Pick<Booking, "id" | "fecha" | "hora_inicio" | "hora_fin">[]> {
    let query = supabase
      .from(this.table)
      .select("id, fecha, hora_inicio, hora_fin")
      .eq("business_id", businessId)
      .neq("estado", "cancelada")
      .gte("fecha", from)
      .lte("fecha", to);

    if (barberId) {
      query = query.eq("barber_id", barberId);
    }

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Pick<Booking, "id" | "fecha" | "hora_inicio" | "hora_fin">[];
  }

  async findPendingReminders(): Promise<Booking[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fecha = tomorrow.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("fecha", fecha)
      .eq("estado", "confirmada")
      .is("reminder_sent_at", null);

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Booking[];
  }

  async findEmailsByBusiness(
    businessId: string,
    beforeFecha: string,
    emails: string[],
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("cliente_email")
      .eq("business_id", businessId)
      .lt("fecha", beforeFecha)
      .neq("estado", "cancelada")
      .in("cliente_email", emails);

    if (error) throw new AppError(error.message, 500);
    return (data ?? []).map((b: { cliente_email: string }) => b.cliente_email);
  }

  async findPreviousClientMatchesByBusiness(
    businessId: string,
    beforeFecha: string,
    emails: string[],
    phones: string[],
  ): Promise<Array<{ cliente_email: string; cliente_telefono: string }>> {
    const requests: PromiseLike<{
      data: { cliente_email: string; cliente_telefono: string }[] | null;
      error: { message: string } | null;
    }>[] = [];

    if (emails.length > 0) {
      requests.push(
        supabase
          .from(this.table)
          .select("cliente_email, cliente_telefono")
          .eq("business_id", businessId)
          .lt("fecha", beforeFecha)
          .neq("estado", "cancelada")
          .in("cliente_email", emails),
      );
    }

    if (phones.length > 0) {
      requests.push(
        supabase
          .from(this.table)
          .select("cliente_email, cliente_telefono")
          .eq("business_id", businessId)
          .lt("fecha", beforeFecha)
          .neq("estado", "cancelada")
          .in("cliente_telefono", phones),
      );
    }

    if (requests.length === 0) return [];

    const results = await Promise.all(requests);
    const merged: Array<{ cliente_email: string; cliente_telefono: string }> = [];

    for (const result of results) {
      if (result.error) throw new AppError(result.error.message, 500);
      merged.push(...(result.data ?? []));
    }

    return merged;
  }

  async create(
    data: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at">,
  ): Promise<Booking> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as Booking;
  }

  async updateEstado(id: string, estado: BookingEstado): Promise<Booking> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update({ estado })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Booking;
  }

  async markReminderSent(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new AppError(error.message, 500);
  }

  async countByMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<BookingsByMonth[]> {
    const { from, to } = this.buildMonthRange(year, month);

    const { data, error } = await supabase
      .from(this.table)
      .select("fecha")
      .eq("business_id", businessId)
      .neq("estado", "cancelada")
      .gte("fecha", from)
      .lte("fecha", to);

    if (error) throw new AppError(error.message, 500);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.fecha] = (counts[row.fecha] ?? 0) + 1;
    }

    return Object.entries(counts).map(([fecha, total]) => ({ fecha, total }));
  }

  async countByBusinessAndMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const { from, to } = this.buildMonthRange(year, month);

    const { count, error } = await supabase
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("estado", "cancelada")
      .gte("fecha", from)
      .lte("fecha", to);

    if (error) throw new AppError(error.message, 500);
    return count ?? 0;
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private buildMonthRange(year: number, month: number): { from: string; to: string } {
    const mm = month.toString().padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    return {
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${lastDay}`,
    };
  }
  async modify(
    id: string,
    data: {
      fecha: string;
      hora_inicio: string;
      hora_fin: string;
      barber_id: string;
      service_id: string;
      estado: BookingEstado;
      modified_at: string;
    },
  ): Promise<Booking> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error?.code === "23505") {
      throw new ConflictError("El horario seleccionado ya está ocupado");
    }
    if (error) throw new AppError(error.message, 500);
    return updated as Booking;
  }

  async cancel(
    id: string,
    data: { cancelled_at: string; cancel_reason: string | null },
  ): Promise<Booking> {
    const { data: updated, error } = await supabase
      .from(this.table)
      .update({ estado: "cancelada", ...data })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return updated as Booking;
  }

}
