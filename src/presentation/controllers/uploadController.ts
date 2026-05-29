import { Request, Response } from "express";
import { supabase }          from "../../infrastructure/database/supabase.client";
import { BarberRepository }  from "../../infrastructure/database/BarberRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";

// ── Tipos de asset permitidos para negocios ───────────────────────────────────
// Whitelist explícita: previene path traversal en Supabase Storage.
// Cualquier valor fuera de este set es rechazado con 400 antes de tocar el storage.
const ALLOWED_ASSET_TYPES = ["logo", "hero", "gallery-0", "gallery-1", "gallery-2",
  "gallery-3", "gallery-4", "gallery-5", "gallery-6", "gallery-7"] as const;
type AssetType = typeof ALLOWED_ASSET_TYPES[number];

function isAllowedAssetType(value: string): value is AssetType {
  return (ALLOWED_ASSET_TYPES as readonly string[]).includes(value);
}

// ── MIME → extensión permitida ────────────────────────────────────────────────
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};

// ── Instancia de repositorio (igual que DomainController) ─────────────────────
// uploadController es un objeto literal sin DI formal; instanciar el repo aquí
// es consistente con el patrón de DomainController.
const barberRepository = new BarberRepository();

export const uploadController = {

  // ── POST /api/upload/barber-photo/:barberId ─────────────────────────────────

  async barberPhoto(req: Request, res: Response): Promise<void> {
    const barberId = req.params["barberId"] as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    // SEC: verificar que el barbero pertenece al negocio del token
    const barber = await barberRepository.findById(barberId);
    if (!barber)                                   throw new NotFoundError("Profesional");
    if (barber.business_id !== req.businessId!) {
      logger.warn("IDOR bloqueado: intento de subir foto de barbero ajeno", {
        businessId: req.businessId, barberId, ownerBusinessId: barber.business_id,
      });
      throw new ForbiddenError();
    }

    const ext  = MIME_TO_EXT[file.mimetype];
    const path = `barbers/${barberId}.${ext}`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      res.status(500).json({ error: "Error al subir la imagen" });
      return;
    }

    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
    logger.info("Foto de barbero subida", { businessId: req.businessId, barberId, path });
    res.json({ url: urlData.publicUrl });
  },

  // ── DELETE /api/upload/barber-photo/:barberId ───────────────────────────────

  async deleteBarberPhoto(req: Request, res: Response): Promise<void> {
    const barberId = req.params["barberId"] as string;

    // SEC: verificar ownership antes de eliminar
    const barber = await barberRepository.findById(barberId);
    if (!barber)                                   throw new NotFoundError("Profesional");
    if (barber.business_id !== req.businessId!) {
      logger.warn("IDOR bloqueado: intento de eliminar foto de barbero ajeno", {
        businessId: req.businessId, barberId, ownerBusinessId: barber.business_id,
      });
      throw new ForbiddenError();
    }

    const paths = Object.values(MIME_TO_EXT).map((ext) => `barbers/${barberId}.${ext}`);
    const { error } = await supabase.storage.from("photos").remove(paths);

    if (error) {
      res.status(500).json({ error: "Error al eliminar la imagen" });
      return;
    }

    logger.info("Foto de barbero eliminada", { businessId: req.businessId, barberId });
    res.json({ message: "Imagen eliminada" });
  },

  // ── POST /api/upload/business/:businessId/:type ─────────────────────────────

  async uploadBusinessAsset(req: Request, res: Response): Promise<void> {
    const businessId = req.params["businessId"] as string;
    const type       = req.params["type"]       as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    // SEC-1: el businessId del path debe coincidir con el del token
    if (businessId !== req.businessId!) {
      logger.warn("IDOR bloqueado: intento de subir asset de negocio ajeno", {
        businessId: req.businessId, targetBusinessId: businessId, type,
      });
      throw new ForbiddenError();
    }

    // SEC-2: whitelist de tipos de asset — previene path traversal en Storage
    if (!isAllowedAssetType(type)) {
      throw new ValidationError(
        `Tipo de asset inválido. Permitidos: ${ALLOWED_ASSET_TYPES.join(", ")}`,
      );
    }

    const ext  = MIME_TO_EXT[file.mimetype];
    const path = `business/${req.businessId!}/${type}.${ext}`;

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      res.status(500).json({ error: "Error al subir la imagen" });
      return;
    }

    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
    logger.info("Asset de negocio subido", { businessId: req.businessId, type, path });
    res.json({ url: urlData.publicUrl });
  },

  // ── DELETE /api/upload/business/:businessId/:type ───────────────────────────

  async deleteBusinessAsset(req: Request, res: Response): Promise<void> {
    const businessId = req.params["businessId"] as string;
    const type       = req.params["type"]       as string;

    // SEC-1: el businessId del path debe coincidir con el del token
    if (businessId !== req.businessId!) {
      logger.warn("IDOR bloqueado: intento de eliminar asset de negocio ajeno", {
        businessId: req.businessId, targetBusinessId: businessId, type,
      });
      throw new ForbiddenError();
    }

    // SEC-2: whitelist de tipos de asset
    if (!isAllowedAssetType(type)) {
      throw new ValidationError(
        `Tipo de asset inválido. Permitidos: ${ALLOWED_ASSET_TYPES.join(", ")}`,
      );
    }

    const paths = Object.values(MIME_TO_EXT).map(
      (ext) => `business/${req.businessId!}/${type}.${ext}`,
    );
    const { error } = await supabase.storage.from("photos").remove(paths);

    if (error) {
      res.status(500).json({ error: "Error al eliminar la imagen" });
      return;
    }

    logger.info("Asset de negocio eliminado", { businessId: req.businessId, type });
    res.json({ message: "Imagen eliminada" });
  },
};