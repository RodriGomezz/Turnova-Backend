import { Router } from "express";
import { serviceController } from "../../container";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { noCache } from "../middlewares/no-cache.middleware";
import { createServiceSchema, updateServiceSchema, reorderServicesSchema } from "../schemas/service.schema";

const router: Router = Router();

// Ruta pública — sin auth
router.get("/defaults", serviceController.listDefaults);

// Rutas protegidas
router.use(authMiddleware);

router.get("/", noCache, serviceController.list);
router.post("/", validate(createServiceSchema), serviceController.create);
router.put("/reorder", validate(reorderServicesSchema), serviceController.reorder);
router.put("/:id", validate(updateServiceSchema), serviceController.update);
router.delete("/:id", serviceController.delete);
router.patch("/:id/reactivate", serviceController.reactivate);
router.delete("/:id/hard", serviceController.hardDelete);

export default router;