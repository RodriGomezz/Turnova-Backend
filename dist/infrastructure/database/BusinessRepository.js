"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class BusinessRepository {
    constructor() {
        this.table = "businesses";
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
    /** Sin filtro `activo` — la capa de aplicación decide qué hacer con negocios pausados */
    async findBySlug(slug) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("slug", slug)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByCustomDomain(domain) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("custom_domain", domain)
            .eq("domain_verified", true)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByAnyCustomDomain(domain) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table)
            .select("*")
            .eq("custom_domain", domain)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
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
        const { error } = await supabase_client_1.supabase
            .from(this.table)
            .delete()
            .eq("id", id);
        if (error)
            throw new errors_1.AppError(error.message, 500);
    }
}
exports.BusinessRepository = BusinessRepository;
//# sourceMappingURL=BusinessRepository.js.map