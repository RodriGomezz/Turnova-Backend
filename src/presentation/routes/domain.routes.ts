import { Router } from "express";
import { DomainController } from "../controllers/DomainController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = new DomainController();

router.use(authMiddleware);

router.get("/", controller.get);
router.post("/", controller.add);
router.delete("/", controller.remove);
router.get("/status", controller.checkStatus);

export default router;
