import { Router } from 'express';
import { BarberController } from '../controllers/BarberController';
import { validate } from '../middlewares/validate.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { noCache } from '../middlewares/no-cache.middleware';
import { createBarberSchema, updateBarberSchema, reorderBarbersSchema } from '../schemas/barber.schema';
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";

const router: Router = Router();
const controller = new BarberController();

router.use(authMiddleware);

router.get('/', noCache, controller.list);
router.post(
  "/",
  invalidatePublicCache,
  validate(createBarberSchema),
  controller.create,
);
// Debe ir ANTES de PUT /:id — mismo motivo que las rutas de /services más
// abajo: Express, si no, interpreta "reorder" como un :id de barbero.
router.put(
  "/reorder",
  invalidatePublicCache,
  validate(reorderBarbersSchema),
  controller.reorder,
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
router.get("/:id/services",               noCache, controller.listServices);
router.post("/:id/services",              controller.addService);
router.delete("/:id/services/:serviceId", controller.removeService);

export default router;