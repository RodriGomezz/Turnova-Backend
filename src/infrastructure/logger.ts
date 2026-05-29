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
]);

// Elimina campos sensibles de los objetos antes de loggear
const sanitize = format((info) => {
  if (info.meta && typeof info.meta === "object") {
    info.meta = redact(info.meta as Record<string, unknown>);
  }
  return info;
});

/**
 * PERF-002: redact recursivo con profundidad máxima.
 *
 * El redact original solo sanitizaba el primer nivel del objeto. Si un error
 * encapsulaba datos sensibles en objetos anidados (ej: { user: { token: "x" } }),
 * el token llegaba a los logs sin redactar.
 *
 * depth=4 es el techo: suficiente para estructuras de error reales, evita
 * loops infinitos en objetos con referencias circulares.
 */
function redact(
  obj: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 4) return { "[truncated]": true };

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof Error)
    ) {
      result[key] = redact(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

const logFormat = printf(
  ({ level, message, timestamp, stack }) =>
    `${timestamp} [${level}] ${stack ?? message}`,
);

const isProd = process.env.NODE_ENV === "production";

// Formato de consola: JSON estructurado en producción (Datadog/Loki/CloudWatch),
// texto coloreado en desarrollo para legibilidad humana.
const consoleFormat = isProd
  ? combine(timestamp(), errors({ stack: true }), sanitize(), format.json())
  : combine(
      colorize(),
      timestamp({ format: "HH:mm:ss" }),
      errors({ stack: true }),
      sanitize(),
      logFormat,
    );

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? (isProd ? "warn" : "info"),
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    sanitize(),
    logFormat,
  ),
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({
      filename: path.join("logs", "app.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      // El file transport siempre usa JSON en producción para ingesta limpia
      format: isProd
        ? combine(timestamp(), errors({ stack: true }), sanitize(), format.json())
        : undefined,
    }),
    new transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      format: isProd
        ? combine(timestamp(), errors({ stack: true }), sanitize(), format.json())
        : undefined,
    }),
  ],
});