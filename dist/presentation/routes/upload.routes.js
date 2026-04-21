"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uploadController_1 = require("../controllers/uploadController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Tipo de archivo no permitido"));
    },
});
// Montado en /api/upload — sin prefijo /upload aquí
router.post("/barber-photo/:barberId", auth_middleware_1.authMiddleware, upload.single("photo"), uploadController_1.uploadController.barberPhoto);
router.delete("/barber-photo/:barberId", auth_middleware_1.authMiddleware, uploadController_1.uploadController.deleteBarberPhoto);
router.post("/business/:businessId/:type", auth_middleware_1.authMiddleware, upload.single("photo"), uploadController_1.uploadController.uploadBusinessAsset);
router.delete("/business/:businessId/:type", auth_middleware_1.authMiddleware, uploadController_1.uploadController.deleteBusinessAsset);
exports.default = router;
//# sourceMappingURL=upload.routes.js.map