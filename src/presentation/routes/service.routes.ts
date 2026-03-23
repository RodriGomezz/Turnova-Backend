import { Router } from "express";
import { ServiceController } from "../controllers/ServiceController";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createServiceSchema,
  updateServiceSchema,
} from "../schemas/service.schema";
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";

const router = Router();
const controller = new ServiceController();

// Ruta pública — sin auth
router.get("/defaults", controller.listDefaults);

// Rutas protegidas
router.use(authMiddleware);

router.get("/", controller.list);
router.post(
  "/",
  invalidatePublicCache,
  validate(createServiceSchema),
  controller.create,
);
router.put(
  "/:id",
  invalidatePublicCache,
  validate(updateServiceSchema),
  controller.update,
);
router.delete("/:id", invalidatePublicCache, controller.delete);

export default router;
