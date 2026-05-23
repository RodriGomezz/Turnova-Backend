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

  async create(
    data: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at">,
  ): Promise<Booking> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    // 23505 = unique_violation — dos requests simultáneos pasaron la
    // verificación de disponibilidad y uno perdió la race condition.
    if (error?.code === "23505") {
      throw new ConflictError("El horario seleccionado ya no está disponible");
    }
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

  async findByBusinessAndMonth(
    businessId: string,
    year: number,
    month: number,
  ): Promise<Booking[]> {
    const { from, to } = this.buildMonthRange(year, month);

    const { data, error } = await supabase
      .from(this.table)
      .select(
        "*, barbers(nombre), services(nombre, duracion_minutos, precio, precio_hasta)",
      )
      .eq("business_id", businessId)
      .neq("estado", "cancelada")
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha",       { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Booking[];
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
  
  async countFutureByBarber(barberId: string, businessId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { count, error } = await supabase
    .from(this.table)
    .select('*', { count: 'exact', head: true })
    .eq('barber_id', barberId)
    .eq('business_id', businessId)
    .gte('fecha', today)
    .in('estado', ['pendiente', 'confirmada']);

  if (error) throw new AppError(error.message, 500);
  return count ?? 0;
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
      estado: "modificada" | "confirmada" | "pendiente";
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

  async findPreviousClientMatchesByBusiness(
    businessId: string,
    beforeFecha: string,
    emails: string[],
    phones: string[],
  ): Promise<Pick<Booking, "cliente_email" | "cliente_telefono">[]> {
    // Una sola query con OR entre emails y teléfonos.
    // Supabase no soporta OR entre columnas directamente — usamos dos queries
    // en paralelo y deduplicamos en memoria. Costo: 2 queries vs. N queries.
    const [byEmail, byPhone] = await Promise.all([
      emails.length > 0
        ? supabase
            .from(this.table)
            .select("cliente_email, cliente_telefono")
            .eq("business_id", businessId)
            .lt("fecha", beforeFecha)
            .neq("estado", "cancelada")
            .in("cliente_email", emails)
        : Promise.resolve({ data: [], error: null }),
      phones.length > 0
        ? supabase
            .from(this.table)
            .select("cliente_email, cliente_telefono")
            .eq("business_id", businessId)
            .lt("fecha", beforeFecha)
            .neq("estado", "cancelada")
            .in("cliente_telefono", phones)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (byEmail.error) throw new AppError(byEmail.error.message, 500);
    if (byPhone.error) throw new AppError(byPhone.error.message, 500);

    // Deduplicar por email+telefono
    const seen = new Set<string>();
    const result: Pick<Booking, "cliente_email" | "cliente_telefono">[] = [];
    for (const row of [...(byEmail.data ?? []), ...(byPhone.data ?? [])]) {
      const key = `${row.cliente_email}|${row.cliente_telefono}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(row as Pick<Booking, "cliente_email" | "cliente_telefono">);
      }
    }
    return result;
  }

}