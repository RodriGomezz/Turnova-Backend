"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockedDateRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errorHandler_middleware_1 = require("../../presentation/middlewares/errorHandler.middleware");
class BlockedDateRepository {
    constructor() {
        this.table = "blocked_dates";
    }
    async findByBusiness(businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*, barbers(nombre)")
            .eq("business_id", businessId)
            .order("fecha", { ascending: true });
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async isBlocked(businessId, barberId, fecha) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("id")
            .eq("business_id", businessId)
            .lte("fecha", fecha)
            .gte("fecha_fin", fecha)
            .or(`barber_id.eq.${barberId},barber_id.is.null`);
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return (data ?? []).length > 0;
    }
    async create(data) {
        const payload = {
            ...data,
            fecha_fin: data.fecha_fin ?? data.fecha,
        };
        const { data: created, error } = await supabase_client_1.supabase
            .from(this.table)
            .insert(payload)
            .select()
            .single();
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return created;
    }
    async delete(id) {
        const { error } = await supabase_client_1.supabase.from(this.table).delete().eq("id", id);
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
    }
}
exports.BlockedDateRepository = BlockedDateRepository;
//# sourceMappingURL=BlockedDateRepository.js.map