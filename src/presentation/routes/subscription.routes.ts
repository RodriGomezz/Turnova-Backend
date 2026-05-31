import { Router } from "express";
import { subscriptionController, webhookController } from "../../container";
import { validate }        from "../middlewares/validate.middleware";
import { authMiddleware }  from "../middlewares/auth.middleware";
import { publicLimiter }   from "../middlewares/rateLimiter.middleware";
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from "../schemas/subscription.schema";

const router: Router = Router();

// ── Webhook — sin auth, con verificación HMAC propia ─────────────────────────
router.post("/dlocal", webhookController.handleDLocal);
router.get("/plans", publicLimiter, subscriptionController.getPlans);
router.get("/confirm-stream", subscriptionController.confirmStream);

// ── Panel — protegidas con authMiddleware ─────────────────────────────────────
router.use(authMiddleware);
router.get("/",        subscriptionController.get);
router.get("/history", subscriptionController.getHistory);
router.post("/sse-token", subscriptionController.issueSseToken);

router.post("/create",    validate(createSubscriptionSchema), subscriptionController.create);
router.post("/reconcile", subscriptionController.reconcile);
router.post("/cancel",    validate(cancelSubscriptionSchema), subscriptionController.cancel);

export default router;