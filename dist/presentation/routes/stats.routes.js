"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const StatsController_1 = require("../controllers/StatsController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const controller = new StatsController_1.StatsController();
router.use(auth_middleware_1.authMiddleware);
router.get("/", controller.get);
exports.default = router;
//# sourceMappingURL=stats.routes.js.map