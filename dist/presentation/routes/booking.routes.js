"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rateLimiter_middleware_1 = require("../middlewares/rateLimiter.middleware");
const booking_schema_1 = require("../schemas/booking.schema");
const supabase_client_1 = require("../../infrastructure/database/supabase.client");
const public_cache_1 = require("../../infrastructure/cache/public.cache");
const business_status_1 = require("../../domain/business-status");
const subscription_access_1 = require("../../domain/subscription-access");
const container_1 = require("../../container");
const router = (0, express_1.Router)();
// ── Panel del dueño (protegidas) ──────────────────────────────
router.get("/panel", auth_middleware_1.authMiddleware, container_1.bookingController.listByDate);
router.post("/panel", auth_middleware_1.authMiddleware, (0, validate_middleware_1.validate)(booking_schema_1.createBookingSchema), container_1.bookingController.createPanel);
router.patch("/panel/:id/estado", auth_middleware_1.authMiddleware, container_1.bookingController.updateEstado);
router.get("/panel/month", auth_middleware_1.authMiddleware, container_1.bookingController.getMonthSummary);
// Junto a las otras rutas del panel
router.get('/panel/day-summary', auth_middleware_1.authMiddleware, container_1.bookingController.getDaySummary);
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
async function getPublicBusinessData(slug) {
    const { data: business, error: bizError } = await supabase_client_1.supabase
        .from('businesses')
        .select(PUBLIC_SELECT)
        .eq('slug', slug)
        .single();
    if (bizError) {
        if (bizError.code === 'PGRST116')
            return { notFound: true };
        throw new Error(bizError.message);
    }
    if (!business)
        return { notFound: true };
    // Cast explícito — Supabase no puede inferir el tipo desde un string de select dinámico
    const b = business;
    const businessStatus = (0, business_status_1.getBusinessStatus)(b);
    const isDisponible = businessStatus === 'active' || businessStatus === 'trial';
    const [barbersRes, servicesRes] = isDisponible
        ? await Promise.all([
            supabase_client_1.supabase
                .from('barbers')
                .select('id, nombre, foto_url, descripcion, orden')
                .eq('business_id', b.id)
                .eq('activo', true)
                .order('orden'),
            supabase_client_1.supabase
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
            barbers: isDisponible ? (barbersRes.data ?? []) : [],
            services: isDisponible ? (servicesRes.data ?? []) : [],
        },
    };
}
// ── Página pública por slug ────────────────────────────────────────────────
router.get("/public/:slug", async (req, res, next) => {
    try {
        const slug = req.params["slug"];
        const cached = (0, public_cache_1.getCached)(slug);
        if (cached) {
            res.json(cached);
            return;
        }
        const result = await getPublicBusinessData(slug);
        if (result.notFound) {
            res.status(404).json({ error: "Negocio no encontrado" });
            return;
        }
        (0, public_cache_1.setCache)(slug, result.data.business.id, result.data);
        res.json(result.data);
    }
    catch (err) {
        next(err);
    }
});
// ── Página pública por dominio personalizado ───────────────────────────────
router.get("/public/domain/:domain", async (req, res, next) => {
    try {
        const domain = req.params["domain"];
        const { data: biz, error } = await supabase_client_1.supabase
            .from("businesses")
            .select("slug, plan, trial_ends_at")
            .eq("custom_domain", domain)
            .eq("domain_verified", true)
            .single();
        if (error ||
            !biz ||
            !(0, subscription_access_1.canUseCustomDomain)(biz.plan, biz.trial_ends_at)) {
            res.status(404).json({ error: "Dominio no encontrado" });
            return;
        }
        const cached = (0, public_cache_1.getCached)(biz.slug);
        if (cached) {
            res.json(cached);
            return;
        }
        const result = await getPublicBusinessData(biz.slug);
        if (result.notFound) {
            res.status(404).json({ error: "Negocio no encontrado" });
            return;
        }
        (0, public_cache_1.setCache)(biz.slug, result.data.business.id, result.data);
        res.json(result.data);
    }
    catch (err) {
        next(err);
    }
});
// ── Rutas públicas de reserva ──────────────────────────────────────────────
router.get("/public/:slug/available-days", container_1.bookingController.getAvailableDays);
router.get("/public/:slug/slots", rateLimiter_middleware_1.bookingLimiter, container_1.bookingController.getAvailableSlots);
router.post("/public/:slug", rateLimiter_middleware_1.bookingLimiter, (0, validate_middleware_1.validate)(booking_schema_1.createBookingSchema), container_1.bookingController.createPublic);
router.patch("/public/cancel/:token", container_1.bookingController.cancelByToken);
exports.default = router;
//# sourceMappingURL=booking.routes.js.map