import { createLogger, format, transports } from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, errors } = format;

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
const sanitize = format((info) => {
  if (info.meta && typeof info.meta === "object") {
    info.meta = redact(info.meta as Record<string, unknown>);
  }
  return info;
});

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = SENSITIVE_FIELDS.has(key.toLowerCase())
      ? "[REDACTED]"
      : value;
  }
  return result;
}

const logFormat = printf(
  ({ level, message, timestamp, stack }) =>
    `${timestamp} [${level}] ${stack ?? message}`,
);

export const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    sanitize(),
    logFormat,
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "HH:mm:ss" }),
        errors({ stack: true }),
        sanitize(),
        logFormat,
      ),
    }),
    new transports.File({
      filename: path.join("logs", "app.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});
