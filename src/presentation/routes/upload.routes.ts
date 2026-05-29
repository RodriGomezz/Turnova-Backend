import { Router, Request, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import { uploadController } from "../controllers/uploadController";
import { authMiddleware }   from "../middlewares/auth.middleware";
import { uploadLimiter }    from "../middlewares/rateLimiter.middleware";

const router: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Tipo de archivo no permitido"));
  },
});

function handleUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();

      if (err instanceof MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "La imagen no puede superar 5MB" });
        } else {
          res.status(400).json({ error: `Error al procesar el archivo: ${err.message}` });
        }
        return;
      }

      res.status(400).json({
        error: (err as Error).message ?? "Archivo no válido",
      });
    });
  };
}

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

router.post(
  "/barber-photo/:barberId",
  authMiddleware,
  uploadLimiter,
  handleUpload("photo"),
  asyncHandler(uploadController.barberPhoto),
);

router.delete(
  "/barber-photo/:barberId",
  authMiddleware,
  asyncHandler(uploadController.deleteBarberPhoto),
);

router.post(
  "/business/:businessId/:type",
  authMiddleware,
  uploadLimiter,
  handleUpload("photo"),
  asyncHandler(uploadController.uploadBusinessAsset),
);

router.delete(
  "/business/:businessId/:type",
  authMiddleware,
  asyncHandler(uploadController.deleteBusinessAsset),
);

export default router;