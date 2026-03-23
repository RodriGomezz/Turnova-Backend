import { Router } from "express";
import { StatsController } from "../controllers/StatsController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = new StatsController();

router.use(authMiddleware);
router.get("/", controller.get);

export default router;
