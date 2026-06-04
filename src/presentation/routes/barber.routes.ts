import { Router } from 'express';
import { BarberController } from '../controllers/BarberController';
import { validate } from '../middlewares/validate.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createBarberSchema, updateBarberSchema } from '../schemas/barber.schema';
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";

const router: Router = Router();
const controller = new BarberController();

router.use(authMiddleware);

router.get('/', controller.list);
router.post(
  "/",
  invalidatePublicCache,
  validate(createBarberSchema),
  controller.create,
);
router.put(
  "/:id",
  invalidatePublicCache,
  validate(updateBarberSchema),
  controller.update,
);
router.delete("/:id", invalidatePublicCache, controller.delete);

// ── Servicios por barbero (M2M) ───────────────────────────────────────────────
// IMPORTANTE: estas rutas deben ir ANTES de /:id para que Express no confunda
// "services" con un :id de barbero.
router.get("/:id/services",               controller.listServices);
router.post("/:id/services",              controller.addService);
router.delete("/:id/services/:serviceId", controller.removeService);

export default router;