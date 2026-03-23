import { Router } from "express";
import multer from "multer";
import { uploadController } from "../controllers/uploadController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Tipo de archivo no permitido"));
  },
});

// Montado en /api/upload — sin prefijo /upload aquí
router.post(
  "/barber-photo/:barberId",
  authMiddleware,
  upload.single("photo"),
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
  upload.single("photo"),
  uploadController.uploadBusinessAsset,
);
router.delete(
  "/business/:businessId/:type",
  authMiddleware,
  uploadController.deleteBusinessAsset,
);

export default router;
