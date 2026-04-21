"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class ServiceRepository {
    constructor() {
        this.table = "services";
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
            .order("created_at", { ascending: true });
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
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
    async listDefaults(tipoNegocio) {
        let query = supabase_client_1.supabase
            .from("services_defaults")
            .select("*")
            .order("precio_sugerido", { ascending: true });
        if (tipoNegocio) {
            query = query.eq("tipo_negocio", tipoNegocio);
        }
        const { data, error } = await query;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
}
exports.ServiceRepository = ServiceRepository;
//# sourceMappingURL=ServiceRepository.js.map