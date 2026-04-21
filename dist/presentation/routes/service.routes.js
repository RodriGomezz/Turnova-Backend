"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const container_1 = require("../../container");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const service_schema_1 = require("../schemas/service.schema");
const invalidate_cache_middleware_1 = require("../middlewares/invalidate-cache.middleware");
const router = (0, express_1.Router)();
// Ruta pública — sin auth
router.get("/defaults", container_1.serviceController.listDefaults);
// Rutas protegidas
router.use(auth_middleware_1.authMiddleware);
router.get("/", container_1.serviceController.list);
router.post("/", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(service_schema_1.createServiceSchema), container_1.serviceController.create);
router.put("/:id", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(service_schema_1.updateServiceSchema), container_1.serviceController.update);
router.delete("/:id", invalidate_cache_middleware_1.invalidatePublicCache, container_1.serviceController.delete);
exports.default = router;
//# sourceMappingURL=service.routes.js.map