"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const container_1 = require("../../container");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const subscription_schema_1 = require("../schemas/subscription.schema");
const router = (0, express_1.Router)();
// ── Webhook — sin auth, con verificación HMAC propia ─────────────────────────
// IMPORTANTE: debe recibir el body como Buffer para verificar la firma.
// En app.ts agregar antes de express.json():
//   app.use('/api/webhooks', express.raw({ type: 'application/json' }));
router.post("/dlocal", container_1.webhookController.handleDLocal);
// ── Panel — protegidas ────────────────────────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
router.get("/", container_1.subscriptionController.get);
router.get("/history", container_1.subscriptionController.getHistory);
router.post("/create", (0, validate_middleware_1.validate)(subscription_schema_1.createSubscriptionSchema), container_1.subscriptionController.create);
router.delete("/cancel", (0, validate_middleware_1.validate)(subscription_schema_1.cancelSubscriptionSchema), container_1.subscriptionController.cancel);
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map