import { createLogger, format, transports } from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, errors } = format;

// ── Campos sensibles a redactar ───────────────────────────────────────────────
const SENSITIVE_FIELDS = new Set([
  "password",
  "token",
  "refresh_token",
  "refreshtoken",
  "access_token",
  "accesstoken",
  "authorization",
  "cliente_email",
  "email",
  "secret",
  "api_key",
  "apikey",
  "secret_key",
  "secretkey",
  "cvv",
  "card_number",
  "cardnumber",
]);

// ── Redact recursivo ──────────────────────────────────────────────────────────
function redact(
  obj: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 4) return { "[truncated]": true };

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null &&
        typeof item === "object" &&
        !(item instanceof Date) &&
        !(item instanceof Error)
          ? redact(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else if (
      value !== null &&
      typeof value === "object" &&
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

// ── Sanitize format ───────────────────────────────────────────────────────────
// Redacta todos los campos del log info, no solo info.meta.
// Se usa try/catch para que un error en el redact nunca rompa el logger.
const sanitize = format((info) => {
  try {
    const { level, message, timestamp: ts, stack, [Symbol.for('level')]: symLevel, ...rest } = info as any;
    const sanitized = redact(rest as Record<string, unknown>);
    return Object.assign(info, sanitized);
  } catch {
    return info;
  }
});

// ── Formatos ──────────────────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length
    ? " " + JSON.stringify(meta)
    : "";
  return `${ts} [${level}] ${stack ?? message}${metaStr}`;
});

const isProd = process.env.NODE_ENV === "production";

const fileFormat = () =>
  isProd
    ? combine(
        timestamp(),
        errors({ stack: true }),
        sanitize(),
        format.json(),
      )
    : combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        sanitize(),
        logFormat,
      );

const consoleFormat = isProd
  ? combine(
      timestamp(),
      errors({ stack: true }),
      sanitize(),
      format.json(),
    )
  : combine(
      timestamp({ format: "HH:mm:ss" }),
      errors({ stack: true }),
      sanitize(),
      logFormat,
      colorize({ all: true }),
    );

// ── Logger ────────────────────────────────────────────────────────────────────
export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? (isProd ? "warn" : "info"),

  // Formato global mínimo — solo timestamp y errors.
  // sanitize y logFormat se aplican en cada transport para que
  // el metadata no quede consumido antes de llegar al printf.
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
  ),

  transports: [
    new transports.Console({ format: consoleFormat }),

    new transports.File({
      filename: path.join("logs", "app.log"),
      maxsize:  5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format:   fileFormat(),
    }),

    new transports.File({
      filename: path.join("logs", "error.log"),
      level:    "error",
      maxsize:  5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format:   fileFormat(),
    }),
  ],

  exceptionHandlers: [
    new transports.File({ filename: path.join("logs", "exceptions.log") }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join("logs", "rejections.log") }),
  ],
  exitOnError: false,
});