import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { bookingLimiter } from "../middlewares/rateLimiter.middleware";
import { createBookingSchema } from "../schemas/booking.schema";
import { supabase } from "../../infrastructure/database/supabase.client";
import { getCached, setCache } from "../../infrastructure/cache/public.cache";
import { getBusinessStatus } from "../../domain/business-status";
import { Business } from "../../domain/entities/Business";
import { canUseCustomDomain } from "../../domain/subscription-access";
import { bookingController as controller } from '../../container';

const router = Router();

// ── Panel del dueño (protegidas) ──────────────────────────────
router.get("/panel", authMiddleware, controller.listByDate);
router.post(
  "/panel",
  authMiddleware,
  validate(createBookingSchema),
  controller.createPanel,
);
router.patch("/panel/:id/estado", authMiddleware, controller.updateEstado);
router.get("/panel/month", authMiddleware, controller.getMonthSummary);
// Junto a las otras rutas del panel
router.get('/panel/day-summary', authMiddleware, controller.getDaySummary);
// ── Helpers ────────────────────────────────────────────────────────────────

const PUBLIC_SELECT = [
  "id",
  "slug",
  "nombre",
  "logo_url",
  "color_fondo",
  "color_acento",
  "color_superficie",
  "whatsapp",
  "direccion",
  "email",
  "frase_bienvenida",
  "hero_imagen_url",
  "instagram",
  "facebook",
  "tipografia",
  "estilo_cards",
  "termino_profesional",
  "termino_profesional_plural",
  "termino_servicio",
  "termino_reserva",
  "plan",
  "trial_ends_at",
  "activo",
].join(", ");

async function getPublicBusinessData(slug: string) {
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select(PUBLIC_SELECT)
    .eq('slug', slug)
    .single();

  if (bizError) {
    if (bizError.code === 'PGRST116') return { notFound: true } as const;
    throw new Error(bizError.message);
  }

  if (!business) return { notFound: true } as const;

  // Cast explícito — Supabase no puede inferir el tipo desde un string de select dinámico
  
  const b = business as unknown as Business;

  const businessStatus = getBusinessStatus(b);
  const isDisponible   = businessStatus === 'active' || businessStatus === 'trial';

  const [barbersRes, servicesRes] = isDisponible
    ? await Promise.all([
        supabase
          .from('barbers')
          .select('id, nombre, foto_url, descripcion, orden')
          .eq('business_id', b.id)
          .eq('activo', true)
          .order('orden'),
        supabase
          .from('services')
          .select('id, nombre, descripcion, duracion_minutos, precio, precio_hasta, incluye')
          .eq('business_id', b.id)
          .eq('activo', true),
      ])
    : [{ data: [] }, { data: [] }];

  return {
    notFound: false,
    data: {
      business: { ...b, status: businessStatus },
      barbers:  isDisponible ? (barbersRes.data ?? []) : [],
      services: isDisponible ? (servicesRes.data ?? []) : [],
    },
  } as const;
}

// ── Página pública por slug ────────────────────────────────────────────────

router.get("/public/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params["slug"] ?? "").trim().toLowerCase();
    const cached = getCached(slug);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await getPublicBusinessData(slug);

    if (result.notFound) {
      res.status(404).json({ error: "Negocio no encontrado" });
      return;
    }

    setCache(slug, result.data.business.id, result.data);
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

// ── Página pública por dominio personalizado ───────────────────────────────

router.get("/public/domain/:domain", async (req, res, next) => {
  try {
    const domain = String(req.params["domain"] ?? "").trim().toLowerCase();

    const { data: biz, error } = await supabase
      .from("businesses")
      .select("slug, plan, trial_ends_at")
      .eq("custom_domain", domain)
      .eq("domain_verified", true)
      .single();

    if (
      error ||
      !biz ||
      !canUseCustomDomain(biz.plan, biz.trial_ends_at)
    ) {
      res.status(404).json({ error: "Dominio no encontrado" });
      return;
    }

    const cached = getCached(biz.slug);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await getPublicBusinessData(biz.slug);

    if (result.notFound) {
      res.status(404).json({ error: "Negocio no encontrado" });
      return;
    }

    setCache(biz.slug, result.data.business.id, result.data);
    res.json(result.data);
  } catch (err) {
    next(err);
  }
});

// ── Rutas públicas de reserva ──────────────────────────────────────────────

router.get("/public/:slug/available-days", controller.getAvailableDays);
router.get("/public/:slug/slots", bookingLimiter, controller.getAvailableSlots);
router.post(
  "/public/:slug",
  bookingLimiter,
  validate(createBookingSchema),
  controller.createPublic,
);
router.patch("/public/cancel/:token", controller.cancelByToken);

export default router;
