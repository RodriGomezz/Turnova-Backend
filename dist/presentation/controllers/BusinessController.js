"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessController = void 0;
const errors_1 = require("../../domain/errors");
const plan_limits_1 = require("../../domain/plan-limits");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const public_cache_1 = require("../../infrastructure/cache/public.cache");
class BusinessController {
    constructor(businessRepository, barberRepository, userRepository, userBusinessAccess) {
        this.businessRepository = businessRepository;
        this.barberRepository = barberRepository;
        this.userRepository = userRepository;
        this.userBusinessAccess = userBusinessAccess;
        this.get = async (req, res, next) => {
            try {
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                res.json({ business });
            }
            catch (error) {
                next(error);
            }
        };
        this.update = async (req, res, next) => {
            try {
                const input = req.body;
                const business = await this.businessRepository.update(req.businessId, input);
                res.json({ business });
            }
            catch (error) {
                next(error);
            }
        };
        this.getStatus = async (req, res, next) => {
            try {
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                const trialActivo = business.trial_ends_at
                    ? new Date(business.trial_ends_at) > new Date()
                    : false;
                const limits = (0, plan_limits_1.getPlanLimits)(business.plan, trialActivo);
                const totalBarberos = await this.barberRepository.countByBusiness(req.businessId);
                res.json({
                    plan: business.plan,
                    trialActivo,
                    maxBarberos: limits.maxBarberos,
                    totalBarberos,
                    excedeLimit: totalBarberos > limits.maxBarberos,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.completeOnboarding = async (req, res, next) => {
            try {
                await this.businessRepository.update(req.businessId, { onboarding_completed: true });
                res.json({ message: "Onboarding completado" });
            }
            catch (error) {
                next(error);
            }
        };
        this.switchBusiness = async (req, res, next) => {
            try {
                const userId = req.userId;
                const { business_id } = req.body;
                const hasAccess = await this.userBusinessAccess.hasAccess(userId, business_id);
                if (!hasAccess)
                    throw new errors_1.AppError("No tenés acceso a ese negocio", 403);
                await this.userRepository.update(userId, { business_id });
                (0, auth_middleware_1.invalidateUserCache)(userId);
                res.json({ message: "Negocio activo actualizado" });
            }
            catch (error) {
                next(error);
            }
        };
        this.listUserBusinesses = async (req, res, next) => {
            try {
                const userId = req.userId;
                const businesses = await this.userBusinessAccess.findByUser(userId);
                res.json({ businesses });
            }
            catch (error) {
                next(error);
            }
        };
        this.deactivate = async (req, res, next) => {
            try {
                const userId = req.userId;
                const businessId = req.params["id"];
                await this.assertAccessAndNotPrincipal(userId, businessId);
                await this.businessRepository.update(businessId, { activo: false });
                (0, public_cache_1.invalidateByBusinessId)(businessId);
                await this.switchToPrincipalIfActive(userId, businessId);
                res.json({ message: "Sucursal desactivada correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        this.reactivate = async (req, res, next) => {
            try {
                const userId = req.userId;
                const businessId = req.params["id"];
                const hasAccess = await this.userBusinessAccess.hasAccess(userId, businessId);
                if (!hasAccess)
                    throw new errors_1.AppError("No tenés acceso a ese negocio", 403);
                await this.businessRepository.update(businessId, { activo: true });
                (0, public_cache_1.invalidateByBusinessId)(businessId);
                res.json({ message: "Sucursal reactivada correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        this.deleteBranch = async (req, res, next) => {
            try {
                const userId = req.userId;
                const businessId = req.params["id"];
                await this.assertAccessAndNotPrincipal(userId, businessId);
                const business = await this.businessRepository.findById(businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                if (business.activo) {
                    throw new errors_1.AppError("Desactivá la sucursal antes de eliminarla permanentemente", 400);
                }
                await this.businessRepository.delete(businessId);
                (0, public_cache_1.invalidateByBusinessId)(businessId);
                await this.switchToPrincipalIfActive(userId, businessId);
                res.json({ message: "Sucursal eliminada permanentemente" });
            }
            catch (error) {
                next(error);
            }
        };
    }
    // ── Helpers privados ──────────────────────────────────────────────────────
    async assertAccessAndNotPrincipal(userId, businessId) {
        const hasAccess = await this.userBusinessAccess.hasAccess(userId, businessId);
        if (!hasAccess)
            throw new errors_1.AppError("No tenés acceso a ese negocio", 403);
        const principalId = await this.userBusinessAccess.findPrincipalBusinessId(userId);
        if (principalId === businessId) {
            throw new errors_1.AppError("No podés modificar el negocio principal desde el panel. Contactá soporte.", 403);
        }
    }
    async switchToPrincipalIfActive(userId, deactivatedBusinessId) {
        const user = await this.userRepository.findById(userId);
        if (user?.business_id !== deactivatedBusinessId)
            return;
        const principalId = await this.userBusinessAccess.findPrincipalBusinessId(userId);
        if (!principalId)
            return;
        await this.userRepository.update(userId, { business_id: principalId });
        (0, auth_middleware_1.invalidateUserCache)(userId);
    }
}
exports.BusinessController = BusinessController;
//# sourceMappingURL=BusinessController.js.map