"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const container_1 = require("../../container");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const schedule_schema_1 = require("../schemas/schedule.schema");
const invalidate_cache_middleware_1 = require("../middlewares/invalidate-cache.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── Horarios ──────────────────────────────────────────────────────────────
router.get("/", container_1.scheduleController.listSchedules);
router.post("/", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(schedule_schema_1.createScheduleSchema), container_1.scheduleController.createSchedule);
router.put("/:id", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(schedule_schema_1.updateScheduleSchema), container_1.scheduleController.updateSchedule);
router.delete("/:id", invalidate_cache_middleware_1.invalidatePublicCache, container_1.scheduleController.deleteSchedule);
// ── Fechas bloqueadas ─────────────────────────────────────────────────────
router.get("/blocked", container_1.scheduleController.listBlockedDates);
router.post("/blocked", invalidate_cache_middleware_1.invalidatePublicCache, (0, validate_middleware_1.validate)(schedule_schema_1.createBlockedDateSchema), container_1.scheduleController.createBlockedDate);
router.delete("/blocked/:id", invalidate_cache_middleware_1.invalidatePublicCache, container_1.scheduleController.deleteBlockedDate);
exports.default = router;
//# sourceMappingURL=schedule.routes.js.map