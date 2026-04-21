"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errorHandler_middleware_1 = require("../../presentation/middlewares/errorHandler.middleware");
class UserRepository {
    constructor() {
        this.table = "users";
    }
    async findById(id) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("id", id)
            .single();
        if (error && error.code === "PGRST116")
            return null;
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return data;
    }
    async findByBusinessId(businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("business_id", businessId)
            .single();
        if (error && error.code === "PGRST116")
            return null;
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return data;
    }
    async create(data) {
        const { data: created, error } = await supabase_client_1.supabase
            .from(this.table)
            .insert(data)
            .select()
            .single();
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
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
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return updated;
    }
    async findBusinessesByUserId(userId) {
        const { data, error } = await supabase_client_1.supabase
            .from("user_businesses")
            .select("businesses(id, nombre, slug, logo_url)")
            .eq("user_id", userId);
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
        return (data ?? []).map((row) => row.businesses).filter(Boolean);
    }
    async addBusinessAccess(userId, businessId) {
        const { error } = await supabase_client_1.supabase
            .from("user_businesses")
            .insert({ user_id: userId, business_id: businessId, role: "owner" });
        if (error)
            throw new errorHandler_middleware_1.AppError(error.message, 500);
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=UserRepository.js.map