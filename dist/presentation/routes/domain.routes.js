"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DomainController_1 = require("../controllers/DomainController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const controller = new DomainController_1.DomainController();
router.use(auth_middleware_1.authMiddleware);
router.get("/", controller.get);
router.post("/", controller.add);
router.delete("/", controller.remove);
router.get("/status", controller.checkStatus);
exports.default = router;
//# sourceMappingURL=domain.routes.js.map