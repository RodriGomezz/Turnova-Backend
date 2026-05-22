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

// ── Panel — protegidas con authMiddleware ─────────────────────────────────────
router.use(authMiddleware);

router.get("/",        subscriptionController.get);
router.get("/history", subscriptionController.getHistory);

/**
 * GET /api/subscriptions/confirm-stream
 *
 * Endpoint SSE — el frontend se conecta tras volver del checkout de dLocal Go.
 * Emite el evento `payment_confirmed` cuando el webhook de dLocal Go llega
 * y el pago es procesado, eliminando la latencia del polling.
 *
 * No registrar generalLimiter aquí — SSE es una conexión persistente,
 * no un request puntual. authMiddleware ya la protege.
 */
router.get("/confirm-stream", subscriptionController.confirmStream);

router.post("/create", validate(createSubscriptionSchema), subscriptionController.create);
router.post("/reconcile", subscriptionController.reconcile);
router.post("/cancel", validate(cancelSubscriptionSchema), subscriptionController.cancel);

export default router;
