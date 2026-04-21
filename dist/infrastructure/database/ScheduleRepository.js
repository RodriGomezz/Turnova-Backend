"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class ScheduleRepository {
    constructor() {
        this.table = "schedules";
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
    async findForBarber(businessId, barberId, diaSemana) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("business_id", businessId)
            .eq("dia_semana", diaSemana)
            .eq("activo", true);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        if (!data || data.length === 0)
            return null;
        const barberSchedule = data.find((s) => s.barber_id === barberId) ?? null;
        const businessSchedule = data.find((s) => s.barber_id === null) ?? null;
        return (barberSchedule ?? businessSchedule);
    }
    /**
     * Retorna horarios resolviendo precedencia barbero > negocio por día.
     * Sin `barberId` devuelve solo los horarios del negocio.
     */
    async findAllByBusiness(businessId, barberId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("business_id", businessId)
            .eq("activo", true);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        const schedules = (data ?? []);
        if (!barberId) {
            return schedules.filter((s) => s.barber_id === null);
        }
        const byDay = new Map();
        for (const s of schedules) {
            const existing = byDay.get(s.dia_semana);
            if (!existing || s.barber_id === barberId) {
                byDay.set(s.dia_semana, s);
            }
        }
        return Array.from(byDay.values());
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
    async update(id, data) {
        const { data: updated, error } = await supabase_client_1.supabase
            .from(this.table)
            .update(data)
            .eq("id", id)
            .select()
            .single();
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return updated;
    }
    async delete(id) {
        const { error } = await supabase_client_1.supabase.from(this.table).delete().eq("id", id);
        if (error)
            throw new errors_1.AppError(error.message, 500);
    }
}
exports.ScheduleRepository = ScheduleRepository;
//# sourceMappingURL=ScheduleRepository.js.map