import { Router } from "express";
import { subscriptionController, webhookController } from "../../container";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from "../schemas/subscription.schema";

const router: Router = Router();

// ── Webhooks — sin auth, con verificación de firma propia ────────────────────

/**
 * MercadoPago webhook — ACTIVO
 * Recibe notificaciones de pagos y suscripciones de MP.
 * Firma verificada via x-signature + MP_WEBHOOK_SECRET.
 * NO necesita raw buffer (MP firma campos del payload, no el body raw).
 *
 * Configurar en el Dashboard de MP → Tus integraciones → Webhooks:
 *   URL: https://tudominio.com/api/subscriptions/mercadopago
 *   Tópicos: subscription_preapproval_plan, subscription_preapproval, payments
 */
router.post("/mercadopago", webhookController.handleMercadoPago);

/**
 * dLocal Go webhook — DESACTIVADO (ruta comentada).
 * Descomentar para reactivar. Requiere raw body (ver app.ts).
 *
 * IMPORTANTE: Si se reactiva dLocal, también descomentar en app.ts:
 *   app.use('/api/subscriptions/dlocal', express.raw({ type: 'application/json' }));
 */
// router.post("/dlocal", webhookController.handleDLocal);

// ── Panel — protegidas ────────────────────────────────────────────────────────
router.use(authMiddleware);

router.get("/", subscriptionController.get);
router.get("/history", subscriptionController.getHistory);
router.post("/create", validate(createSubscriptionSchema), subscriptionController.create);
router.post("/cancel", validate(cancelSubscriptionSchema), subscriptionController.cancel);

export default router;