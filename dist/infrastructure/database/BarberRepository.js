"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarberRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class BarberRepository {
    constructor() {
        this.table = "barbers";
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
    async findByBusiness(businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("business_id", businessId)
            .eq("activo", true)
            .order("orden", { ascending: true });
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async countByBusiness(businessId) {
        const { count, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("activo", true);
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return count ?? 0;
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
    /** Soft delete — marca como inactivo, no elimina físicamente */
    async deactivate(id) {
        const { error } = await supabase_client_1.supabase
            .from(this.table)
            .update({ activo: false })
            .eq("id", id);
        if (error)
            throw new errors_1.AppError(error.message, 500);
    }
}
exports.BarberRepository = BarberRepository;
//# sourceMappingURL=BarberRepository.js.map