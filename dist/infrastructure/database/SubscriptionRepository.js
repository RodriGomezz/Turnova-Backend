"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRepository = void 0;
const supabase_client_1 = require("./supabase.client");
const errors_1 = require("../../domain/errors");
class SubscriptionRepository {
    constructor() {
        this.table = "subscriptions";
    }
    async findById(id) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*").eq("id", id).single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByBusinessId(businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false })
            .limit(1).single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findActiveByBusinessId(businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("business_id", businessId)
            .in("status", ["active", "past_due", "grace_period"])
            .order("created_at", { ascending: false })
            .limit(1).single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findCurrentEffectiveByBusinessId(businessId) {
        const now = new Date().toISOString();
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("business_id", businessId)
            .or(`status.in.(active,past_due,grace_period),and(status.eq.canceled,current_period_end.gt.${now})`)
            .order("created_at", { ascending: false })
            .limit(1).single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findPendingByBusinessId(businessId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("business_id", businessId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1).single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByDlocalId(dlocalSubscriptionId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("dlocal_subscription_id", dlocalSubscriptionId)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findByPaymentId(paymentId) {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("dlocal_payment_id", paymentId)
            .single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async findExpiredGracePeriods() {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("status", "grace_period")
            .lt("grace_period_ends_at", new Date().toISOString());
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async findEndedCanceledSubscriptions() {
        const { data, error } = await supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("status", "canceled")
            .not("current_period_end", "is", null)
            .lt("current_period_end", new Date().toISOString());
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return (data ?? []);
    }
    async findMostRecentPending(businessId) {
        let query = supabase_client_1.supabase
            .from(this.table).select("*")
            .eq("status", "pending")
            .not("dlocal_subscription_id", "like", "DP-%")
            .order("created_at", { ascending: false })
            .limit(1);
        // Restringir al negocio si se conoce — evita asignar el webhook de un negocio
        // al checkout pendiente de otro cuando dLocal no envía order_id.
        if (businessId) {
            query = query.eq("business_id", businessId);
        }
        const { data, error } = await query.single();
        if (error?.code === "PGRST116")
            return null;
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return data;
    }
    async create(data) {
        const { data: created, error } = await supabase_client_1.supabase
            .from(this.table).insert(data).select().single();
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return created;
    }
    async updateStatus(id, status, extra = {}) {
        const { data: updated, error } = await supabase_client_1.supabase
            .from(this.table).update({ status, ...extra })
            .eq("id", id).select().single();
        if (error)
            throw new errors_1.AppError(error.message, 500);
        return updated;
    }
}
exports.SubscriptionRepository = SubscriptionRepository;
//# sourceMappingURL=SubscriptionRepository.js.map