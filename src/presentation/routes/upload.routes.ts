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

/**
 * Wrapper que convierte errores de multer en respuestas JSON claras.
 *
 * Sin esto, los errores de multer (archivo demasiado grande, tipo inválido)
 * no llegan al errorHandler global de Express — quedan sin manejar y el
 * cliente recibe un timeout sin respuesta o un HTML de error sin formato.
 *
 * Multer llama al callback de next() con el error en lugar de lanzarlo,
 * por eso el manejo debe hacerse aquí y no en el errorHandler global.
 */
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

      // Error del fileFilter (tipo de archivo no permitido) u otros
      res.status(400).json({
        error: (err as Error).message ?? "Archivo no válido",
      });
    });
  };
}

// Montado en /api/upload — sin prefijo /upload aquí
router.post(
  "/barber-photo/:barberId",
  authMiddleware,
  uploadLimiter,
  handleUpload("photo"),
  uploadController.barberPhoto,
);
router.delete(
  "/barber-photo/:barberId",
  authMiddleware,
  uploadController.deleteBarberPhoto,
);
router.post(
  "/business/:businessId/:type",
  authMiddleware,
  uploadLimiter,
  handleUpload("photo"),
  uploadController.uploadBusinessAsset,
);
router.delete(
  "/business/:businessId/:type",
  authMiddleware,
  uploadController.deleteBusinessAsset,
);

export default router;
