"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = require("winston");
const path_1 = __importDefault(require("path"));
const { combine, timestamp, printf, colorize, errors } = winston_1.format;
const SENSITIVE_FIELDS = new Set([
    "password",
    "token",
    "refresh_token",
    "access_token",
    "authorization",
    "cliente_email",
    "email",
]);
// Elimina campos sensibles de los objetos antes de loggear
const sanitize = (0, winston_1.format)((info) => {
    if (info.meta && typeof info.meta === "object") {
        info.meta = redact(info.meta);
    }
    return info;
});
function redact(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = SENSITIVE_FIELDS.has(key.toLowerCase())
            ? "[REDACTED]"
            : value;
    }
    return result;
}
const logFormat = printf(({ level, message, timestamp, stack }) => `${timestamp} [${level}] ${stack ?? message}`);
exports.logger = (0, winston_1.createLogger)({
    level: process.env.NODE_ENV === "production" ? "warn" : "debug",
    format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true }), sanitize(), logFormat),
    transports: [
        new winston_1.transports.Console({
            format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), errors({ stack: true }), sanitize(), logFormat),
        }),
        new winston_1.transports.File({
            filename: path_1.default.join("logs", "app.log"),
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
        }),
        new winston_1.transports.File({
            filename: path_1.default.join("logs", "error.log"),
            level: "error",
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});
//# sourceMappingURL=logger.js.map