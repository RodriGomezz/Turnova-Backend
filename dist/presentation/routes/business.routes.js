"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const business_schema_1 = require("../schemas/business.schema");
const invalidate_cache_middleware_1 = require("../middlewares/invalidate-cache.middleware");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const supabase_client_1 = require("../../infrastructure/database/supabase.client");
const container_1 = require("../../container");
const router = (0, express_1.Router)();
const businessPlanGuard = async (req, res, next) => {
    try {
        const { data, error } = await supabase_client_1.supabase
            .from("user_businesses")
            .select("businesses(plan)")
            .eq("user_id", req.userId);
        if (error)
            throw new errorHandler_middleware_1.AppError("Error verificando plan", 500);
        const hasBusiness = (data ?? []).some((row) => row.businesses?.plan === "business");
        if (!hasBusiness)
            throw new errorHandler_middleware_1.AppError("Las sucursales requieren el plan Business", 403);
        next();
    }
    catch (error) {
        next(error);
    }
};
router.use(auth_middleware_1.authMiddleware);
router.get("/", container_1.businessController.get);
router.get("/all", container_1.businessController.listUserBusinesses);
router.put("/", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(business_schema_1.updateBusinessSchema), container_1.businessController.update);
router.get("/status", container_1.businessController.getStatus);
router.patch("/onboarding", container_1.businessController.completeOnboarding);
router.patch("/switch", businessPlanGuard, container_1.businessController.switchBusiness);
router.patch("/:id/deactivate", container_1.businessController.deactivate);
router.patch("/:id/reactivate", container_1.businessController.reactivate);
router.delete("/:id", container_1.businessController.deleteBranch);
exports.default = router;
//# sourceMappingURL=business.routes.js.map