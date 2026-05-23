#!/usr/bin/env node
/**
 * test-subscription-lifecycle.js
 * Simula el ciclo completo de una suscripción mensual en ~5 minutos.
 *
 * Uso:
 *   node test-subscription-lifecycle.js
 *
 * Lo que hace:
 *   Paso 1  (t=0s)   — Pago inicial     → status: active, period_end: ahora+5min
 *   Paso 2  (t=5min) — Período vence    → el job de expiración lo detectaría aquí
 *   Paso 3  (t=5min) — Renovación       → webhook de pago exitoso → status: active, period_end: +5min más
 *   Paso 4  (t=10min)— Fallo de cobro   → status: past_due
 *   Paso 5  (t=10min)— Segundo fallo    → status: grace_period
 *   Paso 6  (t=10min)— Grace vence      → job degrada a starter (simulado)
 *   Paso 7  (t=10min)— Recuperación     → webhook exitoso → status: active de nuevo
 */

const crypto = require("crypto");
const https  = require("https");
const http   = require("http");

// ══════════════════════════════════════════════════════════════════
//  CONFIGURAR ANTES DE CORRER
// ══════════════════════════════════════════════════════════════════

const CONFIG = {
  backendUrl:     "http://localhost:3000/api/subscriptions/dlocal",
  secret:         "LL0lbk8swFRfMloHjfKwAFxyDVGgcf2ZmAH3mrEA",
  subscriptionId: "0287bbeb-497e-48de-b361-e960eb8154a4",

  // Minutos que dura el "período" simulado (default: 5)
  // El script espera este tiempo entre el paso 1 y el paso 3 (renovación)
  periodMinutes: 5,
};

// ══════════════════════════════════════════════════════════════════

function sign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function buildPayload(type, subscriptionId, invoiceSeq) {
  const base = {
    externalId:     subscriptionId,
    subscriptionId: 99999,
    invoiceId:      `ST-test-token-${invoiceSeq}`,
    mid:            4232,
  };

  switch (type) {
    case "success":   return { ...base };
    case "declined":  return { ...base, status: "DECLINED" };
    case "cancelled": return { ...base, status: "CANCELLED" };
  }
}

async function sendWebhook(type, subscriptionId, invoiceSeq) {
  const payload   = JSON.stringify(buildPayload(type, subscriptionId, invoiceSeq));
  const signature = sign(CONFIG.secret, payload);
  const url       = new URL(CONFIG.backendUrl);
  const isHttps   = url.protocol === "https:";
  const lib       = isHttps ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname,
        method:   "POST",
        headers: {
          "Content-Type":   "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-Signature":    signature,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: e.message }));
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmt(ms) {
  if (ms >= 60000) return `${Math.round(ms / 60000)}min`;
  return `${Math.round(ms / 1000)}s`;
}

function log(step, total, icon, title, detail = "") {
  const pad = String(step).padStart(2, "0");
}

function logResult(res) {
  const icon = res.status === 200 ? "✅" : "❌";
}

async function runLifecycle() {
  const PERIOD_MS = CONFIG.periodMinutes * 60 * 1000;
  const STEPS     = 7;
  let   seq       = 1;
  // ── Paso 1: Pago inicial ────────────────────────────────────────────────────
  log(1, STEPS, "💳", "Pago inicial", "Simula el primer cobro exitoso al suscribirse");
  const r1 = await sendWebhook("success", CONFIG.subscriptionId, seq++);
  logResult(r1);

  if (r1.status !== 200) {
    console.error("\n❌ El backend no respondió 200. Verificá secret y subscriptionId. Abortando.\n");
    process.exit(1);
  }

  // ── Espera: simular el período ──────────────────────────────────────────────
  log(2, STEPS, "⏳", `Esperando ${fmt(PERIOD_MS)} (período activo)...`,
    "En producción dLocal Go esperaría 30 días antes de cobrar");

  // Mostrar cuenta regresiva cada 30s
  const intervals = Math.floor(PERIOD_MS / 30000);
  for (let i = 0; i < intervals; i++) {
    await sleep(30000);
    const remaining = PERIOD_MS - (i + 1) * 30000;
    if (remaining > 0) {
      process.stdout.write(`\r        ⏱  ${fmt(remaining)} restantes...   `);
    }
  }
  // Esperar el tiempo restante
  const leftover = PERIOD_MS % 30000;
  if (leftover > 0) await sleep(leftover);

  // ── Paso 3: Renovación exitosa ──────────────────────────────────────────────
  log(3, STEPS, "🔄", "Renovación exitosa",
    "dLocal Go cobra automáticamente y envía este webhook");
  const r3 = await sendWebhook("success", CONFIG.subscriptionId, seq++);
  logResult(r3);

  await sleep(2000);

  // ── Paso 4: Primer fallo de cobro ────────────────────────────────────────────
  log(4, STEPS, "⚠️ ", "Primer fallo de cobro",
    "Tarjeta sin fondos, expirada, etc.");
  const r4 = await sendWebhook("declined", CONFIG.subscriptionId, seq++);
  logResult(r4);

  await sleep(2000);

  // ── Paso 5: Segundo fallo → grace period ─────────────────────────────────────
  log(5, STEPS, "🔴", "Segundo fallo → grace period",
    "dLocal Go reintentó y volvió a fallar");
  const r5 = await sendWebhook("declined", CONFIG.subscriptionId, seq++);
  logResult(r5);

  await sleep(2000);

  // ── Paso 6: Simular vencimiento de grace period ──────────────────────────────
  log(6, STEPS, "💀", "Grace period vencido (simulado)",
    "En producción el job hourly detectaría que grace_period_ends_at < now()");
  await sleep(2000);

  // ── Paso 7: Recuperación ─────────────────────────────────────────────────────
  log(7, STEPS, "✅", "Recuperación — el usuario actualizó su tarjeta",
    "dLocal Go logra cobrar y envía webhook exitoso");
  const r7 = await sendWebhook("success", CONFIG.subscriptionId, seq++);
  logResult(r7);

}

runLifecycle().catch((err) => {
  console.error("\n❌ Error inesperado:", err.message);
  process.exit(1);
});