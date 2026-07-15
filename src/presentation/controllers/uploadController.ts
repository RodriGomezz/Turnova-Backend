import { Request, Response } from "express";
import sharp from "sharp";
import { supabase }          from "../../infrastructure/database/supabase.client";
import { BarberRepository }  from "../../infrastructure/database/BarberRepository";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import { Business } from "../../domain/entities/Business";
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

function assetTypeToImageKind(type: AssetType): ImageKind {
  if (type === "logo") return "logo";
  if (type === "hero") return "hero";
  return "gallery"; // gallery-0..gallery-7
}

// ── Resize/compresión en el momento de subida ─────────────────────────────────
// Sin Supabase Image Transformations (requiere plan Pro), servir la imagen tal
// cual la sube el usuario significa mandar el archivo completo de la cámara del
// celular (fácil 3-8MB) aunque se muestre como un thumbnail chico en un grid.
// Se resuelve acá, una sola vez por subida, no en cada visita. Todo se
// convierte a webp independientemente del formato de entrada — mejor
// compresión que jpg/png a igual calidad percibida.
type ImageKind = "logo" | "hero" | "gallery" | "barber";

const RESIZE_CONFIG: Record<ImageKind, { width: number; height: number | null; fit: "cover" | "inside" }> = {
  logo:    { width: 400,  height: 400, fit: "cover" },  // logo cuadrado, mismo tamaño en todos lados
  hero:    { width: 1920, height: null, fit: "inside" }, // fondo full-bleed, no hace falta más que ancho de pantalla
  gallery: { width: 1600, height: null, fit: "inside" }, // sirve tanto para el grid como para el lightbox
  barber: { width: 600, height: 800, fit: "cover" },  // headshot, tamaño fijo chico
};

async function processImage(buffer: Buffer, kind: ImageKind): Promise<Buffer> {
  const cfg = RESIZE_CONFIG[kind];
  try {
    return await sharp(buffer)
      .rotate() // respeta el EXIF orientation antes de resizear (fotos de celular vienen rotadas seguido)
      .resize(cfg.width, cfg.height, { fit: cfg.fit, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err) {
    logger.warn("No se pudo procesar la imagen subida (¿archivo corrupto?)", {
      error: err instanceof Error ? err.message : err,
    });
    throw new ValidationError("El archivo de imagen parece estar dañado o no es una imagen válida.");
  }
}

// CACHE-BUSTING: antes el path era fijo (ej: `barbers/${barberId}.${ext}`) y se
// sobreescribía con upsert:true en cada subida. Eso significa que la URL pública
// nunca cambiaba, así que navegadores y cualquier CDN delante de Supabase seguían
// sirviendo la imagen vieja desde caché hasta que expiraba (o el usuario la
// limpiaba a mano) — aunque el archivo en el bucket ya fuera otro.
//
// Ahora cada subida genera un nombre único (`${id}-${timestamp}.${ext}`). La URL
// pública cambia siempre que la imagen cambia, así que:
//   - Cache-Control puede ser "immutable" sin riesgo: el path nunca se reusa.
//   - No hace falta ningún cache-busting del lado del frontend.
// El archivo anterior (si existía) se borra después de confirmar que la
// subida nueva fue exitosa, para no dejar basura acumulándose en el bucket.

const PHOTOS_BUCKET_PUBLIC_PREFIX = "/storage/v1/object/public/photos/";

// Extrae el path dentro del bucket "photos" a partir de una URL pública de
// Supabase Storage. Devuelve null si la URL no tiene el formato esperado
// (defensivo: nunca debería romper un upload por un dato viejo/inesperado).
function extractStoragePath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const idx = publicUrl.indexOf(PHOTOS_BUCKET_PUBLIC_PREFIX);
  if (idx === -1) return null;
  return publicUrl.slice(idx + PHOTOS_BUCKET_PUBLIC_PREFIX.length);
}

// Cache-Control para archivos con nombre único: un año + immutable.
// Es seguro porque ese path exacto nunca se va a reescribir.
const IMMUTABLE_CACHE_CONTROL = "31536000";

// ── Instancia de repositorio (igual que DomainController) ─────────────────────
// uploadController es un objeto literal sin DI formal; instanciar el repo aquí
// es consistente con el patrón de DomainController.
const barberRepository   = new BarberRepository();
const businessRepository = new BusinessRepository();

// Mapea un AssetType a su URL actual en el negocio y al nombre de columna
// correspondiente para poder leer/escribir el campo correcto:
//   - "logo"       → business.logo_url
//   - "hero"       → business.hero_imagen_url
//   - "gallery-N"  → business.fotos_galeria[N]
function getAssetCurrentUrl(business: Business, type: AssetType): string | null {
  if (type === "logo") return business.logo_url ?? null;
  if (type === "hero") return business.hero_imagen_url ?? null;
  const galleryIndex = Number(type.replace("gallery-", ""));
  return business.fotos_galeria?.[galleryIndex] ?? null;
}

// Construye el Partial<Business> a aplicar con businessRepository.update()
// para guardar la nueva URL en la columna correcta según el type.
// NOTA: este controller, igual que el original, solo sube el archivo y
// devuelve la URL — no escribe en la tabla `businesses` (eso lo hace el
// frontend con un PATCH separado, como en barbers.ts). Esta función queda
// disponible por si en algún momento se decide mover esa escritura al
// backend; hoy no se invoca dentro de uploadBusinessAsset.
function buildAssetUpdatePatch(
  business: Business,
  type: AssetType,
  newUrl: string,
): Partial<Business> {
  if (type === "logo") return { logo_url: newUrl };
  if (type === "hero") return { hero_imagen_url: newUrl };
  const galleryIndex = Number(type.replace("gallery-", ""));
  const fotos = [...(business.fotos_galeria ?? [])];
  fotos[galleryIndex] = newUrl;
  return { fotos_galeria: fotos };
}

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

    const processedBuffer = await processImage(file.buffer, "barber");

    // Path único por subida — ver nota de CACHE-BUSTING arriba. Siempre .webp:
    // todo pasa por processImage(), que reconvierte cualquier formato de entrada.
    const path = `barbers/${barberId}-${Date.now()}.webp`;

    // Path del archivo anterior (si existía), para borrarlo después de que
    // la subida nueva se confirme. Se calcula ANTES de subir porque depende
    // de la foto_url actual del barbero, todavía no actualizada.
    const previousPath = extractStoragePath(barber.foto_url);

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, processedBuffer, {
        contentType: "image/webp",
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        // upsert ya no es necesario: el path es nuevo en cada subida y nunca
        // colisiona con uno existente. Se deja en false explícito para que
        // un eventual path duplicado falle de forma ruidosa en vez de
        // sobreescribir silenciosamente.
        upsert: false,
      });

    if (error) {
      res.status(500).json({ error: "Error al subir la imagen" });
      return;
    }

    // Limpieza del archivo anterior — best effort. Si falla, no rompemos la
    // respuesta: la foto nueva ya está subida y servible, solo queda un
    // archivo huérfano en el bucket que se puede limpiar con un job aparte.
    if (previousPath && previousPath !== path) {
      const { error: removeError } = await supabase.storage.from("photos").remove([previousPath]);
      if (removeError) {
        logger.warn("No se pudo borrar la foto anterior del barbero (huérfana en bucket)", {
          businessId: req.businessId, barberId, previousPath, error: removeError.message,
        });
      }
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

    // Con nombres únicos ya no podemos adivinar el path por extensión —
    // hay que leerlo de la foto_url actual guardada en la base de datos.
    const currentPath = extractStoragePath(barber.foto_url);
    if (!currentPath) {
      // No había foto guardada (o la URL no tiene el formato esperado): nada que borrar.
      res.json({ message: "Imagen eliminada" });
      return;
    }

    const { error } = await supabase.storage.from("photos").remove([currentPath]);

    if (error) {
      res.status(500).json({ error: "Error al eliminar la imagen" });
      return;
    }

    logger.info("Foto de barbero eliminada", { businessId: req.businessId, barberId, path: currentPath });
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

    const imageKind = assetTypeToImageKind(type as AssetType);
    const processedBuffer = await processImage(file.buffer, imageKind);

    // Path único por subida — ver nota de CACHE-BUSTING arriba. Siempre .webp.
    const path = `business/${req.businessId!}/${type}-${Date.now()}.webp`;

    // Path del asset anterior (si existía), para borrarlo después de que la
    // subida nueva se confirme. type ya pasó por isAllowedAssetType arriba,
    // así que el cast a AssetType es seguro acá.
    const business = await businessRepository.findById(req.businessId!);
    const previousUrl  = business ? getAssetCurrentUrl(business, type as AssetType) : null;
    const previousPath = extractStoragePath(previousUrl);

    const { error } = await supabase.storage
      .from("photos")
      .upload(path, processedBuffer, {
        contentType: "image/webp",
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        upsert: false,
      });

    if (error) {
      res.status(500).json({ error: "Error al subir la imagen" });
      return;
    }

    // Limpieza del archivo anterior — best effort, igual que en barberPhoto.
    if (previousPath && previousPath !== path) {
      const { error: removeError } = await supabase.storage.from("photos").remove([previousPath]);
      if (removeError) {
        logger.warn("No se pudo borrar el asset anterior del negocio (huérfano en bucket)", {
          businessId: req.businessId, type, previousPath, error: removeError.message,
        });
      }
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

    // Con nombres únicos ya no podemos adivinar el path por extensión —
    // hay que leerlo de la URL actual guardada en la base de datos.
    const business = await businessRepository.findById(req.businessId!);
    if (!business) throw new NotFoundError("Negocio");

    const currentUrl  = getAssetCurrentUrl(business, type);
    const currentPath = extractStoragePath(currentUrl);

    if (!currentPath) {
      // No había asset guardado para ese type: nada que borrar.
      res.json({ message: "Imagen eliminada" });
      return;
    }

    const { error } = await supabase.storage.from("photos").remove([currentPath]);

    if (error) {
      res.status(500).json({ error: "Error al eliminar la imagen" });
      return;
    }

    logger.info("Asset de negocio eliminado", { businessId: req.businessId, type, path: currentPath });
    res.json({ message: "Imagen eliminada" });
  },
};