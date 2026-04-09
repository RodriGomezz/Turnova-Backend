import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateBusinessSchema } from "../schemas/business.schema";
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";
import { AppError } from "../middlewares/errorHandler.middleware";
import { supabase } from "../../infrastructure/database/supabase.client";
import { businessController as controller } from '../../container';

const router = Router();

const businessPlanGuard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from("user_businesses")
      .select("businesses(plan)")
      .eq("user_id", req.userId!);

    if (error) throw new AppError("Error verificando plan", 500);

    const hasBusiness = (data ?? []).some(
      (row: any) => row.businesses?.plan === "business",
    );

    if (!hasBusiness)
      throw new AppError("Las sucursales requieren el plan Business", 403);
    next();
  } catch (error) {
    next(error);
  }
};

router.use(authMiddleware);

router.get("/", controller.get);
router.get("/all", controller.listUserBusinesses);
router.put(
  "/",
  invalidatePublicCache,
  validate(updateBusinessSchema),
  controller.update,
);
router.get("/status", controller.getStatus);
router.patch("/onboarding", controller.completeOnboarding);
router.patch("/switch", businessPlanGuard, controller.switchBusiness);
router.patch("/:id/deactivate", controller.deactivate);
router.patch("/:id/reactivate", controller.reactivate);
router.delete("/:id", controller.deleteBranch);

export default router;
