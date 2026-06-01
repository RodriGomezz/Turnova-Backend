import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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

app.use(helmet({
  contentSecurityPolicy:     false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [process.env.FRONTEND_URL ?? "http://localhost:4200"];
const baseDomain     = process.env.BASE_DOMAIN ?? "kronu.pro";

function isAllowedSubdomain(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    if (!host.endsWith(`.${baseDomain}`)) return false;
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
    credentials:    true,
    maxAge:         86400,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Retry-After"],
  }),
);

// ── Cookie parser — necesario para leer el refresh token de la HttpOnly cookie ─
// Debe ir ANTES del body parsing para que req.cookies esté disponible
// en auth.controller.ts (endpoint /auth/refresh).
// No usamos cookie-parser firmado (sin secret) porque el refresh token
// ya viene firmado por Supabase — no necesitamos firma adicional.
app.use(cookieParser());

// ── Webhook dLocal — raw Buffer ANTES de express.json() ──────────────────────
app.use(
  "/api/subscriptions/dlocal",
  express.raw({ type: "application/json" }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/bookings/public',          publicLimiter);
app.use('/api/services/defaults',        publicLimiter);
app.use('/api/subscriptions/plans',      publicLimiter);

app.use('/api/auth/login',          loginByEmailLimiter);
app.use('/api/auth/login',          loginLimiter);
app.use('/api/auth/register',       registerLimiter);
app.use('/api/auth/request-reset',  resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);
app.use('/api/auth/refresh',        refreshLimiter);

app.use('/api/upload',              uploadLimiter);

app.use('/api/barbers',             generalLimiter);
app.use('/api/services',            generalLimiter);
app.use('/api/schedules',           generalLimiter);
app.use('/api/business',            generalLimiter);
app.use('/api/bookings/panel',      generalLimiter);
app.use('/api/subscriptions',       generalLimiter);
app.use('/api/stats',               generalLimiter);
app.use('/api/domain',              generalLimiter);

// ── Health checks ─────────────────────────────────────────────────────────────
app.get("/health", healthLimiter, (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/health/ready", healthLimiter, async (_req, res) => {
  const start = Date.now();
  try {
    const { error } = await import("./infrastructure/database/supabase.client")
      .then(({ supabase }) =>
        supabase.from("businesses").select("id").limit(1).maybeSingle(),
      );

    if (error) throw error;

    res.json({
      status:    "ready",
      supabase:  "ok",
      latency:   `${Date.now() - start}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    res.status(503).json({
      status:    "not ready",
      supabase:  "error",
      error:     message,
      latency:   `${Date.now() - start}ms`,
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

app.use(errorHandler);