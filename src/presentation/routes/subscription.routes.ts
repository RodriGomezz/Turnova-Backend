import { Router } from "express";
import { subscriptionController, webhookController } from "../../container";
import { validate }        from "../middlewares/validate.middleware";
import { authMiddleware }  from "../middlewares/auth.middleware";
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from "../schemas/subscription.schema";

const router: Router = Router();

// ── Webhook — sin auth, con verificación HMAC propia ─────────────────────────
// IMPORTANTE: debe recibir el body como Buffer para verificar la firma HMAC.
// En app.ts ya está registrado antes de express.json():
//   app.use('/api/subscriptions/dlocal', express.raw({ type: 'application/json' }))
router.post("/dlocal", webhookController.handleDLocal);

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