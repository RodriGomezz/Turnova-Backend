import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { loginLimiter, loginByEmailLimiter, registerLimiter, refreshLimiter, resetLimiter } from "../middlewares/rateLimiter.middleware";
import { registerSchema, loginSchema, resendConfirmationSchema } from "../schemas/auth.schema";

const router: Router = Router();
const controller = new AuthController();

router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  controller.register,
);
router.post("/login", loginByEmailLimiter, loginLimiter, validate(loginSchema), controller.login);
router.post("/refresh", refreshLimiter, controller.refresh);
router.get("/me", authMiddleware, controller.me);
router.put("/profile", authMiddleware, controller.updateProfile);
router.post("/request-reset", resetLimiter, controller.requestPasswordReset);
router.post(
  "/resend-confirmation",
  resetLimiter,
  validate(resendConfirmationSchema),
  controller.resendConfirmation,
);
router.post("/reset-password", resetLimiter, controller.resetPassword);
router.post("/branch", authMiddleware, controller.createBranch);

export default router;
