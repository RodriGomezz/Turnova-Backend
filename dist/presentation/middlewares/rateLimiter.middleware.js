"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicLimiter = exports.bookingLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../../infrastructure/logger");
const isDev = process.env.NODE_ENV !== "production";
function onLimitReached(req, options) {
    logger_1.logger.warn("Rate limit alcanzado", {
        ip: req.ip,
        method: req.method,
        path: req.path,
        max: options.max,
        windowS: options.windowMs ? options.windowMs / 1000 : undefined,
    });
}
function makeHandler(message) {
    return (req, res, _next, options) => {
        onLimitReached(req, options);
        res.status(429).json({ error: message });
    };
}
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    handler: makeHandler("Demasiadas solicitudes, intentá en unos minutos"),
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    handler: makeHandler("Demasiados intentos, esperá 15 minutos"),
});
exports.bookingLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    handler: makeHandler("Límite de reservas alcanzado, intentá en una hora"),
});
exports.publicLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
    handler: makeHandler("Demasiadas solicitudes"),
});
//# sourceMappingURL=rateLimiter.middleware.js.map