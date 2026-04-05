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

export const app: Application = express();

app.use(compression());
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const baseDomain    = process.env.BASE_DOMAIN    ?? 'turnio.pro';
const frontendUrl   = process.env.FRONTEND_URL   ?? 'http://localhost:4200';
const vercelProject = process.env.VERCEL_PROJECT  ?? 'turnova-frontend'; // nombre del proyecto en Vercel

// Orígenes exactos siempre permitidos
const exactOrigins = new Set([
  frontendUrl,
  'http://localhost:4200',
  `https://${baseDomain}`,
  `https://www.${baseDomain}`,
]);

// Patrones dinámicos (subdominios de Vercel y del dominio propio)
const originPatterns: RegExp[] = [
  // Cualquier deploy de Vercel del proyecto: turnova-frontend-xxx-yyy.vercel.app
  new RegExp(`^https://${vercelProject}[a-z0-9-]*\\.vercel\\.app$`),
  // Subdominios del dominio propio: xxx.turnio.pro
  new RegExp(`^https://[a-z0-9-]+\\.${baseDomain.replace('.', '\\.')}$`),
  // Subdominios de localhost en desarrollo: xxx.localhost:4200
  /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Sin origin → Postman, curl, server-to-server
      if (!origin) return callback(null, true);

      if (exactOrigins.has(origin)) return callback(null, true);

      if (originPatterns.some((re) => re.test(origin))) return callback(null, true);

      callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// ── Rate limiting ──────────────────────────────────────────────────────────────
app.use('/api/bookings/public', publicLimiter);
app.use('/api/auth',           authLimiter);
app.use('/api/barbers',        generalLimiter);
app.use('/api/services',       generalLimiter);
app.use('/api/schedules',      generalLimiter);
app.use('/api/business',       generalLimiter);
app.use('/api/bookings/panel', generalLimiter);

// ── Logger ────────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rutas ──────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/barbers',  barberRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/schedules',scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/domain',   domainRoutes);
app.use('/api/stats',    statsRoutes);

// ── Error handler (siempre al final) ──────────────────────────────────────────
app.use(errorHandler);