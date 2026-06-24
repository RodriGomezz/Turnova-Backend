import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { noCache } from "../middlewares/no-cache.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateBusinessSchema } from "../schemas/business.schema";
import { invalidatePublicCache } from "../middlewares/invalidate-cache.middleware";
import { AppError } from "../../domain/errors";
import { supabase } from "../../infrastructure/database/supabase.client";
import { businessController as controller } from "../../container";
import { publicLimiter } from "../middlewares/rateLimiter.middleware";
import { isSlugAvailable } from "../../infrastructure/cache/slug.cache";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";

const router: Router = Router();
const businessRepository = new BusinessRepository();

// ── Verificación de slug — pública, sin auth ──────────────────────────────────
// Rate-limited (publicLimiter: 120 req/min) para prevenir enumeración masiva.
// Responde en < 1 ms (lookup en Set<string>) sin queries a la BD.
//
// SEC: No revelar información de negocios. Solo devolvemos available: true/false.
// Un actor malicioso puede enumerar slugs con este endpoint, pero:
//   - Los slugs son parte de la URL pública (/public/:slug) — ya son públicos.
//   - El rate limiter frena la enumeración masiva.
//   - No revelamos el nombre del negocio ni datos adicionales.
router.get(
  "/slug-check",
  publicLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw  = String(req.query["slug"] ?? "").trim().toLowerCase();
      const slug = raw.replace(/[^a-z0-9-]/g, "").slice(0, 50);

      if (!slug || slug.length < 3) {
        res.json({ available: false, reason: "too_short" });
        return;
      }

      const available = await isSlugAvailable(slug);
      res.json({ slug, available });
    } catch (err) {
      next(err);
    }
  },
);

// ── Dominios verificados — pública, sin auth ──────────────────────────────────
// Consumida por el server SSR (server.ts) para construir allowedHosts dinámico.
// Refrescada periódicamente en memoria del proceso Node — no en cada request.
//
// SEC: Sin datos sensibles. Son los mismos hostnames que cualquiera ve
// visitando el sitio del negocio (ej. mibarberia.com). Rate-limited igual
// que slug-check porque es público y sin auth.
router.get(
  "/public/verified-domains",
  publicLimiter,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const domains = await businessRepository.findAllVerifiedDomains();
      res.json({ domains });
    } catch (err) {
      next(err);
    }
  },
);

// ── Slugs activos — pública, sin auth ──────────────────────────────────────────
// Consumida por el server SSR para generar /sitemap.xml dinámicamente
// (tanto el sitemap del dominio raíz como el de cada negocio individual).
//
// SEC: Sin datos sensibles. El slug ya es público (es la URL del negocio:
// slug.kronu.pro), y created_at solo se usa como lastmod del sitemap.
router.get(
  "/public/active-slugs",
  publicLimiter,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businesses = await businessRepository.findAllActiveSlugs();
      res.json({ businesses });
    } catch (err) {
      next(err);
    }
  },
);

// ── Rutas protegidas ──────────────────────────────────────────────────────────

const businessPlanGuard = async (
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from("user_businesses")
      .select("businesses(plan)")
      .eq("user_id", req.userId!);

    if (error) throw new AppError("Error verificando plan", 500);

    const hasBusiness = (data ?? []).some(
      (row: any) => row.businesses?.plan === "business",
    );

    if (!hasBusiness)
      throw new AppError("Las sucursales requieren el plan Business", 403);
    next();
  } catch (error) {
    next(error);
  }
};

router.use(authMiddleware);

router.get("/", noCache, controller.get);
router.get("/all", noCache, controller.listUserBusinesses);
router.put(
  "/",
  invalidatePublicCache,
  validate(updateBusinessSchema),
  controller.update,
);
router.get("/status", noCache, controller.getStatus);
router.patch("/onboarding", controller.completeOnboarding);
router.patch("/switch", businessPlanGuard, controller.switchBusiness);
router.patch("/:id/deactivate", controller.deactivate);
router.patch("/:id/reactivate", controller.reactivate);
router.delete("/:id", controller.deleteBranch);

export default router;
