import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { generalLimiter, authLimiter, publicLimiter } from './presentation/middlewares/rateLimiter.middleware';
import { errorHandler } from './presentation/middlewares/errorHandler.middleware';
import { requestLogger } from './presentation/middlewares/requestLogger.middleware';
import authRoutes from './presentation/routes/auth.routes';
import barberRoutes from './presentation/routes/barber.routes';
import serviceRoutes from './presentation/routes/service.routes';
import scheduleRoutes from './presentation/routes/schedule.routes';
import bookingRoutes from './presentation/routes/booking.routes';
import businessRoutes from './presentation/routes/business.routes';import compression from 'compression';
import uploadRoutes from "./presentation/routes/upload.routes";
import domainRoutes from "./presentation/routes/domain.routes";
import statsRoutes from "./presentation/routes/stats.routes";

export const app: Application = express();

app.use(compression());
// ── Seguridad HTTP ────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [process.env.FRONTEND_URL ?? "http://localhost:4200"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Origen exacto permitido
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Subdominios de localhost en desarrollo
      if (
        process.env.NODE_ENV === "development" &&
        origin.match(/^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/)
      ) {
        return callback(null, true);
      }

      // Subdominios de producción
      const baseDomain = process.env.BASE_DOMAIN ?? "turnio.pro";
      if (
        origin.match(
          new RegExp(
            `^https://[a-z0-9-]+\\.${baseDomain.replace(".", "\\.")}$`,
          ),
        )
      ) {
        return callback(null, true);
      }

      callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
  }),
);

// ── Límite de tamaño de request (previene DoS) ────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// ── Rate limiting general ─────────────────────────────────────
// Rutas públicas — límite propio
app.use('/api/bookings/public', publicLimiter);

// Auth — límite estricto
app.use('/api/auth', authLimiter);

// Panel — límite generoso para usuarios autenticados
app.use('/api/barbers',   generalLimiter);
app.use('/api/services',  generalLimiter);
app.use('/api/schedules', generalLimiter);
app.use('/api/business',  generalLimiter);
app.use('/api/bookings/panel', generalLimiter);

// ── Logger de requests ────────────────────────────────────────
app.use(requestLogger);

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas (se agregan acá a medida que se construyen) ─────────
app.use('/api/auth', authRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/business', businessRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/domain", domainRoutes);
app.use("/api/stats", statsRoutes);

// ── Manejo de errores (siempre al final) ──────────────────────
app.use(errorHandler);