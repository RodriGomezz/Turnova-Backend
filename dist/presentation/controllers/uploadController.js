"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadController = void 0;
const supabase_client_1 = require("../../infrastructure/database/supabase.client");
const MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};
exports.uploadController = {
    async barberPhoto(req, res) {
        const { barberId } = req.params;
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "No se recibió ningún archivo" });
            return;
        }
        const ext = MIME_TO_EXT[file.mimetype];
        const path = `barbers/${barberId}.${ext}`;
        const { error } = await supabase_client_1.supabase.storage
            .from("photos")
            .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
        if (error) {
            res.status(500).json({ error: "Error al subir la imagen" });
            return;
        }
        const { data: urlData } = supabase_client_1.supabase.storage
            .from("photos")
            .getPublicUrl(path);
        res.json({ url: urlData.publicUrl });
    },
    async deleteBarberPhoto(req, res) {
        const { barberId } = req.params;
        const paths = Object.values(MIME_TO_EXT).map((ext) => `barbers/${barberId}.${ext}`);
        const { error } = await supabase_client_1.supabase.storage.from("photos").remove(paths);
        if (error) {
            res.status(500).json({ error: "Error al eliminar la imagen" });
            return;
        }
        res.json({ message: "Imagen eliminada" });
    },
    async uploadBusinessAsset(req, res) {
        const { businessId, type } = req.params;
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "No se recibió ningún archivo" });
            return;
        }
        const ext = MIME_TO_EXT[file.mimetype];
        const path = `business/${businessId}/${type}.${ext}`;
        const { error } = await supabase_client_1.supabase.storage
            .from("photos")
            .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
        if (error) {
            res.status(500).json({ error: "Error al subir la imagen" });
            return;
        }
        const { data: urlData } = supabase_client_1.supabase.storage
            .from("photos")
            .getPublicUrl(path);
        res.json({ url: urlData.publicUrl });
    },
    async deleteBusinessAsset(req, res) {
        const { businessId, type } = req.params;
        const paths = Object.values(MIME_TO_EXT).map((ext) => `business/${businessId}/${type}.${ext}`);
        const { error } = await supabase_client_1.supabase.storage.from("photos").remove(paths);
        if (error) {
            res.status(500).json({ error: "Error al eliminar la imagen" });
            return;
        }
        res.json({ message: "Imagen eliminada" });
    },
};
//# sourceMappingURL=uploadController.js.map