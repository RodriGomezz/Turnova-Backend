import { Router } from "express";
import { serviceController } from "../../container";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { createServiceSchema, updateServiceSchema } from "../schemas/service.schema";
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";

const router = Router();

// Ruta pública — sin auth
router.get("/defaults", serviceController.listDefaults);

// Rutas protegidas
router.use(authMiddleware);

router.get("/", serviceController.list);
router.post("/", invalidatePublicCache, validate(createServiceSchema), serviceController.create);
router.put("/:id", invalidatePublicCache, validate(updateServiceSchema), serviceController.update);
router.delete("/:id", invalidatePublicCache, serviceController.delete);

export default router;
