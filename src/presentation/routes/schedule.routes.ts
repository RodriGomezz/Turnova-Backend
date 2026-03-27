import { Router } from "express";
import { scheduleController } from "../../container";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  createScheduleSchema,
  updateScheduleSchema,
  createBlockedDateSchema,
} from "../schemas/schedule.schema";
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";

const router = Router();

router.use(authMiddleware);

// ── Horarios ──────────────────────────────────────────────────────────────
router.get("/", scheduleController.listSchedules);
router.post(
  "/",
  invalidatePublicCache,
  validate(createScheduleSchema),
  scheduleController.createSchedule,
);
router.put(
  "/:id",
  invalidatePublicCache,
  validate(updateScheduleSchema),
  scheduleController.updateSchedule,
);
router.delete("/:id", invalidatePublicCache, scheduleController.deleteSchedule);

// ── Fechas bloqueadas ─────────────────────────────────────────────────────
router.get("/blocked", scheduleController.listBlockedDates);
router.post(
  "/blocked",
  invalidatePublicCache,
  validate(createBlockedDateSchema),
  scheduleController.createBlockedDate,
);
router.delete(
  "/blocked/:id",
  invalidatePublicCache,
  scheduleController.deleteBlockedDate,
);

export default router;
