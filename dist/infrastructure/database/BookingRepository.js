"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class BookingRepository {
    constructor() {
        this.table = "bookings";
    }
    async findById(id) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("id", id)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByCancellationToken(token) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("cancellation_token", token)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByBusinessAndDate(businessId, fecha) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*, barbers(nombre), services(nombre, duracion_minutos, precio, precio_hasta)")
            .eq("business_id", businessId)
            .eq("fecha", fecha)
            .neq("estado", "cancelada")
            .order("hora_inicio", { ascending: true });
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async findByBarberAndDate(barberId, fecha) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("barber_id", barberId)
            .eq("fecha", fecha)
            .neq("estado", "cancelada");
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async findByBarberAndMonth(barberId, businessId, from, to) {
        let query = supabase_client_1.supabase
            .from(this.table)
            .select("fecha, hora_inicio, hora_fin")
            .eq("business_id", businessId)
            .neq("estado", "cancelada")
            .gte("fecha", from)
            .lte("fecha", to);
        if (barberId) {
            query = query.eq("barber_id", barberId);
        }
        const { data, error } = await query;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async findPendingReminders() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const fecha = tomorrow.toISOString().split("T")[0];
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("fecha", fecha)
            .eq("estado", "confirmada")
            .is("reminder_sent_at", null);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async findEmailsByBusiness(businessId, beforeFecha, emails) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("cliente_email")
            .eq("business_id", businessId)
            .lt("fecha", beforeFecha)
            .neq("estado", "cancelada")
            .in("cliente_email", emails);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []).map((b) => b.cliente_email);
    }
    async create(data) {
        const { data: created, error } = await supabase_client_1.supabase
            .from(this.table)
            .insert(data)
            .select()
            .single();
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return created;
    }
    async updateEstado(id, estado) {
        const { data: updated, error } = await supabase_client_1.supabase
            .from(this.table)
            .update({ estado })
            .eq("id", id)
            .select()
            .single();
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return updated;
    }
    async markReminderSent(id) {
        const { error } = await supabase_client_1.supabase
            .from(this.table)
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", id);
        if (error)
            throw new errors_1.AppError(error.message, 500);
    }
    async countByMonth(businessId, year, month) {
        const { from, to } = this.buildMonthRange(year, month);
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("fecha")
            .eq("business_id", businessId)
            .neq("estado", "cancelada")
            .gte("fecha", from)
            .lte("fecha", to);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        const counts = {};
        for (const row of data ?? []) {
            counts[row.fecha] = (counts[row.fecha] ?? 0) + 1;
        }
        return Object.entries(counts).map(([fecha, total]) => ({ fecha, total }));
    }
    async countByBusinessAndMonth(businessId, year, month) {
        const { from, to } = this.buildMonthRange(year, month);
        const { count, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*", { count: "exact", head: true })
            .eq("business_id", businessId)
            .neq("estado", "cancelada")
            .gte("fecha", from)
            .lte("fecha", to);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return count ?? 0;
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    buildMonthRange(year, month) {
        const mm = month.toString().padStart(2, "0");
        const lastDay = new Date(year, month, 0).getDate();
        return {
            from: `${year}-${mm}-01`,
            to: `${year}-${mm}-${lastDay}`,
        };
    }
}
exports.BookingRepository = BookingRepository;
//# sourceMappingURL=BookingRepository.js.map