"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const rateLimiter_middleware_1 = require("./presentation/middlewares/rateLimiter.middleware");
const errorHandler_middleware_1 = require("./presentation/middlewares/errorHandler.middleware");
const requestLogger_middleware_1 = require("./presentation/middlewares/requestLogger.middleware");
const auth_routes_1 = __importDefault(require("./presentation/routes/auth.routes"));
const barber_routes_1 = __importDefault(require("./presentation/routes/barber.routes"));
const service_routes_1 = __importDefault(require("./presentation/routes/service.routes"));
const schedule_routes_1 = __importDefault(require("./presentation/routes/schedule.routes"));
const booking_routes_1 = __importDefault(require("./presentation/routes/booking.routes"));
const business_routes_1 = __importDefault(require("./presentation/routes/business.routes"));
const upload_routes_1 = __importDefault(require("./presentation/routes/upload.routes"));
const domain_routes_1 = __importDefault(require("./presentation/routes/domain.routes"));
const stats_routes_1 = __importDefault(require("./presentation/routes/stats.routes"));
const subscription_routes_1 = __importDefault(require("./presentation/routes/subscription.routes"));
exports.app = (0, express_1.default)();
exports.app.use((0, compression_1.default)());
// ── Seguridad HTTP ────────────────────────────────────────────────────────────
exports.app.use((0, helmet_1.default)());
const allowedOrigins = [process.env.FRONTEND_URL ?? "http://localhost:4200"];
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        if (process.env.NODE_ENV === "development" &&
            origin.match(/^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/)) {
            return callback(null, true);
        }
        const baseDomain = process.env.BASE_DOMAIN ?? "turnio.pro";
        if (origin.match(new RegExp(`^https://[a-z0-9-]+\\.${baseDomain.replace(".", "\\.")}$`))) {
            return callback(null, true);
        }
        callback(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
}));
// ── Webhook dLocal — debe recibir raw Buffer ANTES de express.json() ──────────
// dLocal firma el payload con HMAC-SHA256; necesitamos el body sin parsear
exports.app.use("/api/subscriptions/dlocal", express_1.default.raw({ type: "application/json" }));
// ── Body parsing (resto de rutas) ─────────────────────────────────────────────
exports.app.use(express_1.default.json({ limit: "10kb" }));
exports.app.use(express_1.default.urlencoded({ limit: "10kb", extended: true }));
// ── Rate limiting ─────────────────────────────────────────────────────────────
exports.app.use("/api/bookings/public", rateLimiter_middleware_1.publicLimiter);
exports.app.use("/api/auth", rateLimiter_middleware_1.authLimiter);
exports.app.use("/api/barbers", rateLimiter_middleware_1.generalLimiter);
exports.app.use("/api/services", rateLimiter_middleware_1.generalLimiter);
exports.app.use("/api/schedules", rateLimiter_middleware_1.generalLimiter);
exports.app.use("/api/business", rateLimiter_middleware_1.generalLimiter);
exports.app.use("/api/bookings/panel", rateLimiter_middleware_1.generalLimiter);
exports.app.use("/api/subscriptions", rateLimiter_middleware_1.generalLimiter);
// ── Logger ────────────────────────────────────────────────────────────────────
exports.app.use(requestLogger_middleware_1.requestLogger);
// ── Health check ──────────────────────────────────────────────────────────────
exports.app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// ── Rutas ─────────────────────────────────────────────────────────────────────
exports.app.use("/api/auth", auth_routes_1.default);
exports.app.use("/api/barbers", barber_routes_1.default);
exports.app.use("/api/services", service_routes_1.default);
exports.app.use("/api/schedules", schedule_routes_1.default);
exports.app.use("/api/bookings", booking_routes_1.default);
exports.app.use("/api/business", business_routes_1.default);
exports.app.use("/api/upload", upload_routes_1.default);
exports.app.use("/api/domain", domain_routes_1.default);
exports.app.use("/api/stats", stats_routes_1.default);
exports.app.use("/api/subscriptions", subscription_routes_1.default);
// ── Error handler (siempre al final) ──────────────────────────────────────────
exports.app.use(errorHandler_middleware_1.errorHandler);
//# sourceMappingURL=app.js.map