import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/rateLimiter.middleware";
import { registerSchema, loginSchema } from "../schemas/auth.schema";

const router = Router();
const controller = new AuthController();

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  controller.register,
);
router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/refresh", authLimiter, controller.refresh);
router.get("/me", authMiddleware, controller.me);
router.put("/profile", authMiddleware, controller.updateProfile);
router.post("/request-reset", authLimiter, controller.requestPasswordReset);
router.post("/reset-password", controller.resetPassword);
router.post("/branch", authMiddleware, controller.createBranch);

export default router;
