"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBusinessAccessRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class UserBusinessAccessRepository {
    constructor() {
        this.table = "user_businesses";
    }
    async hasAccess(userId, businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("id")
            .eq("user_id", userId)
            .eq("business_id", businessId)
            .single();
        if (error?.code === "PGRST116")
            return false;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return !!data;
    }
    async findByUser(userId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("business_id, created_at, businesses(id, nombre, slug, logo_url, activo, plan, created_at)")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
        if (error)
            throw new errors_1.AppError(error.message, 500);
        const rows = (data ?? []);
        return rows
            .map((row, index) => {
            // Supabase devuelve array para joins — tomamos el primer elemento
            const business = Array.isArray(row.businesses)
                ? row.businesses[0]
                : row.businesses;
            if (!business)
                return null;
            return {
                ...business,
                esPrincipal: index === 0,
            };
        })
            .filter((b) => b !== null);
    }
    async findPrincipalBusinessId(userId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("business_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        const row = data;
        return row?.business_id ?? null;
    }
}
exports.UserBusinessAccessRepository = UserBusinessAccessRepository;
//# sourceMappingURL=UserBusinessAccessRepository.js.map