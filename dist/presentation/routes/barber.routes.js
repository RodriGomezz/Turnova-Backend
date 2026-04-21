"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const BarberController_1 = require("../controllers/BarberController");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const barber_schema_1 = require("../schemas/barber.schema");
const invalidate_cache_middleware_1 = require("../middlewares/invalidate-cache.middleware");
const router = (0, express_1.Router)();
const controller = new BarberController_1.BarberController();
router.use(auth_middleware_1.authMiddleware);
router.get('/', controller.list);
router.post("/", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(barber_schema_1.createBarberSchema), controller.create);
router.put("/:id", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(barber_schema_1.updateBarberSchema), controller.update);
router.delete("/:id", invalidate_cache_middleware_1.invalidatePublicCache, controller.delete);
exports.default = router;
//# sourceMappingURL=barber.routes.js.map