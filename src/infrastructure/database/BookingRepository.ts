import { supabase } from "./supabase.client";
import { Booking, BookingEstado, BookingItem } from "../../domain/entities/Booking";
import { AppError, ConflictError } from "../../domain/errors";
import {
  IBookingRepository,
  BookingsByMonth,
  CreateBookingItemInput,
  ActiveBlockRow,
  ActiveBlockRowWithFecha,
} from "../../domain/interfaces/IBookingRepository";

export class BookingRepository implements IBookingRepository {
  private readonly table = "bookings";
  private readonly itemsTable = "booking_items";

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

  /**
   * Usado por CreateBookingUseCase antes de chequear disponibilidad de
   * slot — si ya existe una reserva con esta key, hay que devolverla
   * directo y NO correr GetAvailableSlotsUseCase, porque esa consulta lee
   * bookings en vivo y en un reintento vería el slot ya ocupado por la
   * reserva que el primer intento sí creó, rechazando el reintento con un
   * falso "horario no disponible". Ver mig. 020.
   */
  async findByIdempotencyKey(key: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("idempotency_key", key)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Booking;
  }

  async findByBusinessAndDate(businessId: string, fecha: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select(
        "*, barbers(nombre), services(nombre, duracion_minutos, precio, precio_hasta), booking_items(id, service_id, nombre, precio, duracion_minutos)",
      )
      .eq("business_id", businessId)
      .eq("fecha", fecha)
      // Se incluyen canceladas a propósito: el panel diario las muestra
      // tachadas/con badge en vez de ocultarlas. Para disponibilidad de
      // slots usar findByBarberAndDate, que sí filtra canceladas.
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

  /**
   * Trae los bloques de atención activa (booking_active_blocks) de todas las
   * reservas no canceladas de este barbero ese día, recortados a "HH:MM"
   * en hora local del negocio para que GetAvailableSlotsUseCase los compare
   * con el mismo formato que usa para hora_inicio/hora_fin.
   *
   * Nota: starts_at/ends_at son TIMESTAMPTZ (absolutos); acá asumimos que
   * el negocio ya opera en un solo huso horario consistente con `fecha`,
   * igual que el resto del cálculo de slots existente (que ya trabaja con
   * horas "naive" sin timezone). Si en el futuro hay negocios multi-huso,
   * este es el punto a revisar.
   */
  async findActiveBlocksByBarberAndDate(
    barberId: string,
    fecha: string,
    excludeBookingId?: string,
  ): Promise<ActiveBlockRow[]> {
    let query = supabase
      .from("booking_active_blocks")
      .select("starts_at, ends_at, bookings!inner(estado)")
      .eq("barber_id", barberId)
      .gte("starts_at", `${fecha}T00:00:00`)
      .lt("starts_at", `${fecha}T23:59:59.999`)
      .neq("bookings.estado", "cancelada");

    if (excludeBookingId) {
      query = query.neq("booking_id", excludeBookingId);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500);

    return ((data ?? []) as Array<{ starts_at: string; ends_at: string }>).map((row) => ({
      hora_inicio: row.starts_at.slice(11, 16),
      hora_fin: row.ends_at.slice(11, 16),
    }));
  }

  /**
   * Igual que findActiveBlocksByBarberAndDate pero para todo un rango de
   * fechas en una sola query — usada por GetAllSlotsForDaysUseCase, que
   * precarga el mes completo. Se agrupa por `fecha` acá mismo (derivada de
   * starts_at) porque el caller necesita bucketear los bloques por día
   * antes de evaluar cada slot candidato.
   */
  async findActiveBlocksByBarberAndMonth(
    barberId: string,
    from: string,
    to: string,
    excludeBookingId?: string,
  ): Promise<ActiveBlockRowWithFecha[]> {
    let query = supabase
      .from("booking_active_blocks")
      .select("starts_at, ends_at, bookings!inner(estado)")
      .eq("barber_id", barberId)
      .gte("starts_at", `${from}T00:00:00`)
      .lt("starts_at", `${to}T23:59:59.999`)
      .neq("bookings.estado", "cancelada");

    if (excludeBookingId) {
      query = query.neq("booking_id", excludeBookingId);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500);

    return ((data ?? []) as Array<{ starts_at: string; ends_at: string }>).map((row) => ({
      fecha: row.starts_at.slice(0, 10),
      hora_inicio: row.starts_at.slice(11, 16),
      hora_fin: row.ends_at.slice(11, 16),
    }));
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

  // Trae candidatos a recordatorio dentro de una ventana de días — el
  // cálculo exacto de "faltan N horas" (donde N es configurable por
  // negocio vía recordatorio_horas_antes) se hace en el job, no acá, porque
  // acá no tenemos el dato de configuración del negocio sin un join. maxDays
  // debe cubrir el máximo configurable (72hs = 3 días) con margen.
  async findConfirmedUpcomingWithoutReminder(maxDays: number): Promise<Booking[]> {
    // Ensanchamos el rango un día de cada lado a propósito: calcular el
    // límite exacto de "hoy" con .toISOString() da la fecha en UTC, que
    // puede diferir de la fecha calendario local (en Montevideo, UTC-3,
    // a partir de las 21:00 locales UTC ya cruzó al día siguiente). En vez
    // de perseguir ese borde con precisión acá, lo ensanchamos y dejamos que
    // el cálculo exacto de "-N horas" en el job (isDue) haga el filtro real.
    const today = new Date();

    const desde = new Date(today);
    desde.setDate(desde.getDate() - 1);
    const desdeStr = desde.toISOString().split("T")[0];

    const hasta = new Date(today);
    hasta.setDate(hasta.getDate() + maxDays + 1);
    const hastaStr = hasta.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .gte("fecha", desdeStr)
      .lte("fecha", hastaStr)
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

  /** @deprecated Usar createWithItems — ver nota en IBookingRepository. */
  async create(
    data: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at">,
  ): Promise<Booking> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    // 23P01 = exclusion_violation — dispara el EXCLUDE USING gist
    // (bookings_no_overlap) cuando dos requests simultáneos pasaron la
    // verificación de disponibilidad y uno perdió la race condition.
    // 23505 también se chequea por si el constraint cambia a unique en el futuro.
    if (error?.code === "23P01" || error?.code === "23505") {
      throw new ConflictError("El horario seleccionado ya no está disponible");
    }
    if (error) throw new AppError(error.message, 500);
    return created as Booking;
  }

  /**
   * Crea una reserva con sus booking_items y booking_ticket inicial en una
   * sola transacción de Postgres (función create_booking_with_items), para
   * que un fallo a mitad de camino no deje datos huérfanos. El constraint
   * bookings_no_overlap se sigue evaluando en el INSERT de bookings dentro
   * de la función — no se mueve ni se duplica.
   */
  async createWithItems(
    bookingData: Omit<Booking, "id" | "cancellation_token" | "reminder_sent_at" | "created_at" | "service_id" | "idempotency_key">,
    items: CreateBookingItemInput[],
    idempotencyKey?: string,
  ): Promise<Booking> {
    const { data, error } = await supabase.rpc("create_booking_with_items", {
      booking_data: { ...bookingData, idempotency_key: idempotencyKey ?? null },
      items_data: items,
    });

    if (error?.code === "23P01" || error?.code === "23505") {
      throw new ConflictError("El horario seleccionado ya no está disponible");
    }
    if (error) throw new AppError(error.message, 500);
    return data as Booking;
  }

  async findItemsByBookingId(bookingId: string): Promise<BookingItem[]> {
    const { data, error } = await supabase
      .from(this.itemsTable)
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as BookingItem[];
  }

  /**
   * Reemplaza el combo completo de servicios de una reserva y actualiza
   * hora_fin, en una sola transacción (función replace_booking_items).
   * Usado por ModifyBookingUseCase cuando se cambia el conjunto de
   * servicios antes de que el turno empiece.
   */
  async replaceItems(
    bookingId: string,
    horaFin: string,
    items: CreateBookingItemInput[],
  ): Promise<Booking> {
    const { data, error } = await supabase.rpc("replace_booking_items", {
      p_booking_id: bookingId,
      p_hora_fin: horaFin,
      items_data: items,
    });

    if (error?.code === "23P01" || error?.code === "23505") {
      throw new ConflictError("El nuevo horario ya no está disponible para este profesional");
    }
    if (error) throw new AppError(error.message, 500);
    return data as Booking;
  }

  async updateEstado(id: string, estado: BookingEstado): Promise<Booking> {
    // Si se cancela desde el panel, registrar cancelled_at igual que cancelByToken
    // (mismo criterio de auditoría). Si se marca no_show, registrar no_show_at
    // de la misma forma. Pasar a cualquier otro estado limpia ambos timestamps
    // para no dejar un estado inconsistente (ej. confirmada con cancelled_at seteado).
    const extra =
      estado === "cancelada"
        ? { cancelled_at: new Date().toISOString(), no_show_at: null }
        : estado === "no_show"
          ? { no_show_at: new Date().toISOString(), cancelled_at: null, cancel_reason: null }
          : { cancelled_at: null, cancel_reason: null, no_show_at: null };

    const { data: updated, error } = await supabase
      .from(this.table)
      .update({ estado, ...extra })
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

  async createActiveBlocks(
    bookingId: string,
    barberId: string,
    blocks: Array<{ starts_at: string; ends_at: string }>,
  ): Promise<void> {
    if (blocks.length === 0) return;

    const { error } = await supabase.from("booking_active_blocks").insert(
      blocks.map((b) => ({
        booking_id: bookingId,
        barber_id: barberId,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
      })),
    );

    // 23P01 = booking_active_blocks_no_overlap — otro turno de este barbero
    // ya ocupa ese rango de atención activa. Mismo código que el resto de
    // conflictos de agenda, para que el caller lo trate igual.
    if (error?.code === "23P01" || error?.code === "23505") {
      throw new ConflictError("El horario seleccionado ya no está disponible");
    }
    if (error) throw new AppError(error.message, 500);
  }

  async regenerateActiveBlocks(bookingId: string): Promise<void> {
    const { error } = await supabase.rpc("regenerate_active_blocks", {
      p_booking_id: bookingId,
    });

    if (error?.code === "23P01" || error?.code === "23505") {
      throw new ConflictError("El horario seleccionado ya no está disponible");
    }
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
        "*, barbers(nombre), services(nombre, duracion_minutos, precio, precio_hasta), booking_items(id, service_id, nombre, precio, duracion_minutos)",
      )
      .eq("business_id", businessId)
      // Se incluyen canceladas a propósito: ver nota en findByBusinessAndDate.
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

    if (error?.code === "23P01" || error?.code === "23505") {
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

    // CRÍTICO: booking_active_blocks_no_overlap no puede filtrar por
    // bookings.estado en su WHERE (un EXCLUDE constraint solo puede mirar
    // columnas de su propia tabla) — si no borramos los bloques acá, un
    // turno cancelado sigue "ocupando" agenda a nivel de base de datos para
    // siempre, y reservar ese mismo horario después falla con un conflicto
    // fantasma. Afecta a TODO barbero con al menos un item de duración > 0,
    // no solo a los que tienen capacidad_sillas > 1 (los bloques activos se
    // generan siempre, sea cual sea la capacidad).
    const { error: blocksError } = await supabase
      .from("booking_active_blocks")
      .delete()
      .eq("booking_id", id);

    if (blocksError) throw new AppError(blocksError.message, 500);

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
