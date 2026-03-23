import { Router } from 'express';
import { ScheduleController } from '../controllers/ScheduleController';
import { validate } from '../middlewares/validate.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createScheduleSchema,
  updateScheduleSchema,
  createBlockedDateSchema,
} from '../schemas/schedule.schema';
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";

const router = Router();
const controller = new ScheduleController();

router.use(authMiddleware);

// Horarios
router.get('/', controller.listSchedules);
router.post(
  "/",
  invalidatePublicCache,
  validate(createScheduleSchema),
  controller.createSchedule,
);
router.put(
  "/:id",
  invalidatePublicCache,
  validate(updateScheduleSchema),
  controller.updateSchedule,
);
router.delete("/:id", invalidatePublicCache, controller.deleteSchedule);


// Fechas bloqueadas
router.get('/blocked', controller.listBlockedDates);
router.post(
  "/blocked",
  invalidatePublicCache,
  validate(createBlockedDateSchema),
  controller.createBlockedDate,
);
router.delete(
  "/blocked/:id",
  invalidatePublicCache,
  controller.deleteBlockedDate,
);

export default router;