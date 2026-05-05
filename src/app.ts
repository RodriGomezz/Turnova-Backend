import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { generalLimiter, authLimiter, publicLimiter } from './presentation/middlewares/rateLimiter.middleware';
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

app.use(compression());

// ── Seguridad HTTP ────────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [process.env.FRONTEND_URL ?? "http://localhost:4200"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      if (
        process.env.NODE_ENV === "development" &&
        origin.match(/^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/)
      ) {
        return callback(null, true);
      }

      const baseDomain = process.env.BASE_DOMAIN ?? "kronu.pro";
      if (
        origin.match(
          new RegExp(`^https://[a-z0-9-]+\\.${baseDomain.replace(".", "\\.")}$`),
        )
      ) {
        return callback(null, true);
      }

      callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
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

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api/bookings/public", publicLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/barbers",        generalLimiter);
app.use("/api/services",       generalLimiter);
app.use("/api/schedules",      generalLimiter);
app.use("/api/business",       generalLimiter);
app.use("/api/bookings/panel", generalLimiter);
app.use("/api/subscriptions",  generalLimiter);

// ── Logger ────────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
