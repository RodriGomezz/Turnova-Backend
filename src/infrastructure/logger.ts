import { createLogger, format, transports } from "winston";

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

// Regex para redactar valores sensibles dentro de strings planos.
// Cubre: "email: foo@bar.com", `token=abc123`, JSON inline, etc.
const SENSITIVE_PATTERN = new RegExp(
  `(${[...SENSITIVE_FIELDS].join("|")})[=:\\s"']+[^\\s"',}&]+`,
  "gi",
);

// ── Redact recursivo sobre objetos ────────────────────────────────────────────
function redactObj(
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
          ? redactObj(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof Date) &&
      !(value instanceof Error)
    ) {
      result[key] = redactObj(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ── Redact de strings planos ──────────────────────────────────────────────────
function redactString(s: string): string {
  return s.replace(SENSITIVE_PATTERN, (match, field) => `${field}=[REDACTED]`);
}

// ── Sanitize format ───────────────────────────────────────────────────────────
const sanitize = format((info) => {
  try {
    // Redactar el mensaje de texto (cubre template literals con datos sensibles)
    if (typeof info.message === "string") {
      info.message = redactString(info.message);
    }

    // Redactar el objeto meta (propiedades extra del log)
    const {
      level,
      message,
      timestamp: ts,
      stack,
      [Symbol.for("level")]: symLevel,
      [Symbol.for("splat")]: splat,
      ...rest
    } = info as any;

    const sanitized = redactObj(rest as Record<string, unknown>);
    return Object.assign(info, sanitized);
  } catch {
    // El logger nunca debe lanzar — si falla el sanitize, logueamos igual
    return info;
  }
});

// ── Formatos ──────────────────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp: ts, stack, requestId, ...meta }) => {
  const rid = requestId ? ` [${requestId}]` : "";
  const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  return `${ts}${rid} [${level}] ${stack ?? message}${metaStr}`;
});

const isProd = process.env.NODE_ENV === "production";

// ── Transport: Console ────────────────────────────────────────────────────────
// En Render, stdout ES el sistema de logs. Todo va aquí.
// - Prod:  JSON estructurado → parseado por Render Logs / Logtail / BetterStack
// - Dev:   Texto coloreado → legible en terminal
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
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),

  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
  ),

  transports: [
    new transports.Console({ format: consoleFormat }),
  ],

  exceptionHandlers: [
    new transports.Console({ format: consoleFormat }),
  ],
  rejectionHandlers: [
    new transports.Console({ format: consoleFormat }),
  ],

  exitOnError: false,
});

export function childLogger(requestId: string) {
  return logger.child({ requestId });
}