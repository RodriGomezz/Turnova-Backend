import { Router } from "express";
import { subscriptionController, webhookController } from "../../container";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from "../schemas/subscription.schema";

const router = Router();

// ── Webhook — sin auth, con verificación HMAC propia ─────────────────────────
// IMPORTANTE: debe recibir el body como Buffer para verificar la firma.
// En app.ts agregar antes de express.json():
//   app.use('/api/webhooks', express.raw({ type: 'application/json' }));
router.post("/dlocal", webhookController.handleDLocal);

// ── Panel — protegidas ────────────────────────────────────────────────────────
router.use(authMiddleware);

router.get("/", subscriptionController.get);
router.get("/history", subscriptionController.getHistory);
router.post("/create", validate(createSubscriptionSchema), subscriptionController.create);
router.delete("/cancel", validate(cancelSubscriptionSchema), subscriptionController.cancel);

export default router;
