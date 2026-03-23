import { Request, Response } from "express";
import { supabase } from "../../infrastructure/database/supabase.client";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const uploadController = {
  async barberPhoto(req: Request, res: Response): Promise<void> {
    const { barberId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    const ext = MIME_TO_EXT[file.mimetype];
    const path = `barbers/${barberId}.${ext}`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      res.status(500).json({ error: "Error al subir la imagen" });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("photos")
      .getPublicUrl(path);
    res.json({ url: urlData.publicUrl });
  },

  async deleteBarberPhoto(req: Request, res: Response): Promise<void> {
    const { barberId } = req.params;
    const paths = Object.values(MIME_TO_EXT).map(
      (ext) => `barbers/${barberId}.${ext}`,
    );

    const { error } = await supabase.storage.from("photos").remove(paths);

    if (error) {
      res.status(500).json({ error: "Error al eliminar la imagen" });
      return;
    }

    res.json({ message: "Imagen eliminada" });
  },

  async uploadBusinessAsset(req: Request, res: Response): Promise<void> {
    const { businessId, type } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    const ext = MIME_TO_EXT[file.mimetype];
    const path = `business/${businessId}/${type}.${ext}`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      res.status(500).json({ error: "Error al subir la imagen" });
      return;
    }

    const { data: urlData } = supabase.storage
      .from("photos")
      .getPublicUrl(path);
    res.json({ url: urlData.publicUrl });
  },

  async deleteBusinessAsset(req: Request, res: Response): Promise<void> {
    const { businessId, type } = req.params;
    const paths = Object.values(MIME_TO_EXT).map(
      (ext) => `business/${businessId}/${type}.${ext}`,
    );

    const { error } = await supabase.storage.from("photos").remove(paths);

    if (error) {
      res.status(500).json({ error: "Error al eliminar la imagen" });
      return;
    }

    res.json({ message: "Imagen eliminada" });
  },
};
