import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { generalLimiter, healthLimiter, publicLimiter, refreshLimiter, resetLimiter, uploadLimiter, loginLimiter, loginByEmailLimiter, registerLimiter } from './presentation/middlewares/rateLimiter.middleware';
import { errorHandler } from './presentation/middlewares/errorHandler.middleware';
import { requestLogger } from './presentation/middlewares/requestLogger.middleware';
import authRoutes from './presentation/routes/auth.routes';
import barberRoutes from './presentation/routes/barber.routes';
import serviceRoutes from './presentation/routes/service.routes';
import scheduleRoutes from './presentation/routes/schedule.routes';
import bookingRoutes from './presentation/routes/booking.routes';
import businessRoutes from './presentation/routes/business.routes';
import uploadRoutes from "./presentation/routes/upload.routes";
import domainRoutes from "./presentation/routes/domain.routes";
import statsRoutes from "./presentation/routes/stats.routes";
import subscriptionRoutes from "./presentation/routes/subscription.routes";

export const app: Application = express();

app.set("trust proxy", 1);

app.use(compression({ threshold: 1024 }));

// ── Seguridad HTTP ────────────────────────────────────────────────────────────
// Helmet con configuración explícita.
// API pura sin HTML: CSP y crossOriginEmbedderPolicy no aplican y se desactivan
// intencionalmente para evitar que headers innecesarios rompan respuestas JSON.
// El resto de los 11 headers de seguridad (HSTS, X-Frame-Options, etc.) quedan activos.
app.use(helmet({
  contentSecurityPolicy:    false,
  crossOriginEmbedderPolicy: false,
}));

// Origins explícitamente permitidos además de los subdominios dinámicos.
// FRONTEND_URL cubre app.kronu.pro (o localhost en desarrollo).
// www y el apex se agregan siempre que BASE_DOMAIN esté definido.
const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:4200",
  ...(process.env.BASE_DOMAIN ? [
    `https://${process.env.BASE_DOMAIN}`,        // kronu.pro
    `https://www.${process.env.BASE_DOMAIN}`,    // www.kronu.pro
  ] : []),
];
const baseDomain = process.env.BASE_DOMAIN ?? "kronu.pro";

/**
 * SEC-006: validar subdominio con URL parsing en lugar de regex construida
 * desde una variable de entorno.
 *
 * El enfoque anterior con RegExp(baseDomain.replace(...)) era vulnerable si
 * BASE_DOMAIN contenía caracteres especiales de regex. También era difícil
 * razonar sobre qué origins exactamente matcheaba.
 *
 * Este enfoque:
 *   1. Parsea el origin como URL (falla si está malformado — bueno).
 *   2. Verifica que termina en `.{baseDomain}` (endsWith — exacto).
 *   3. Verifica que solo hay UN nivel de subdominio (no sub.sub.kronu.pro).
 *   4. Verifica que es HTTPS (los subdominios de producción siempre lo son).
 */
function isAllowedSubdomain(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    if (!host.endsWith(`.${baseDomain}`)) return false;
    // Solo 1 nivel de subdominio: "foo.kronu.pro" → ["foo", "kronu", "pro"]
    // baseDomain "kronu.pro" tiene 2 partes → host debe tener exactamente 3
    const expectedParts = baseDomain.split(".").length + 1;
    return host.split(".").length === expectedParts;
  } catch {
    return false;
  }
}

const allowLocalhost = process.env.ALLOW_LOCALHOST_CORS === "true";

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (isAllowedSubdomain(origin)) return callback(null, true);
      if (allowLocalhost && /^https?:\/\/[a-z0-9-]+\.localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials:           true,
    maxAge:                86400,  // cachear preflight 24h — evita OPTIONS en cada request
    allowedHeaders:        ["Content-Type", "Authorization"],
    exposedHeaders:        ["Retry-After"],  // necesario para que el frontend lea el header de retry
  }),
);

// ── Webhook dLocal — debe recibir raw Buffer ANTES de express.json() ──────────
// dLocal firma el payload con HMAC-SHA256; necesitamos el body sin parsear
app.use(
  "/api/subscriptions/dlocal",
  express.raw({ type: "application/json" }),
);

// ── Body parsing (resto de rutas) ─────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

// ── Logger de requests (antes de rate limiters para capturar cancelados) ──────
app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────

app.use('/api/bookings/public',          publicLimiter);
app.use('/api/services/defaults',        publicLimiter);
app.use('/api/subscriptions/plans',      publicLimiter);

// Login: primero por email (5 intentos / cuenta), luego por IP (30 / red)
app.use('/api/auth/login',          loginByEmailLimiter);
app.use('/api/auth/login',          loginLimiter);
app.use('/api/auth/register',       registerLimiter);
app.use('/api/auth/request-reset',  resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);
app.use('/api/auth/refresh',        refreshLimiter);

app.use('/api/upload',              uploadLimiter);      // nuevo — faltaba

app.use('/api/barbers',             generalLimiter);
app.use('/api/services',            generalLimiter);
app.use('/api/schedules',           generalLimiter);
app.use('/api/business',            generalLimiter);
app.use('/api/bookings/panel',      generalLimiter);
app.use('/api/subscriptions',       generalLimiter);
app.use('/api/stats',               generalLimiter);     // nuevo — faltaba
app.use('/api/domain',              generalLimiter);     // nuevo — faltaba
// ── Health check ──────────────────────────────────────────────────────────────
// /health — liveness: el proceso está vivo (usado por load balancer)
app.get("/health", healthLimiter, (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// /health/ready — readiness: las dependencias críticas responden
// Usado por UptimeRobot o el deploy pipeline antes de mandar tráfico.
app.get("/health/ready", healthLimiter, async (_req, res) => {
  const start = Date.now();
  try {
    // Query liviano — solo verifica que Supabase responde
    const { error } = await import("./infrastructure/database/supabase.client")
      .then(({ supabase }) =>
        supabase.from("businesses").select("id").limit(1).maybeSingle(),
      );

    if (error) throw error;

    res.json({
      status:   "ready",
      supabase: "ok",
      latency:  `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(503).json({
      status:   "not ready",
      supabase: "error",
      error:    message,
      latency:  `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/barbers",       barberRoutes);
app.use("/api/services",      serviceRoutes);
app.use("/api/schedules",     scheduleRoutes);
app.use("/api/bookings",      bookingRoutes);
app.use("/api/business",      businessRoutes);
app.use("/api/upload",        uploadRoutes);
app.use("/api/domain",        domainRoutes);
app.use("/api/stats",         statsRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// ── Error handler (siempre al final) ──────────────────────────────────────────
app.use(errorHandler);