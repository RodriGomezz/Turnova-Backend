/**
 * PERF-003: Este archivo era un duplicado exacto de subscription-expiry.job.ts.
 *
 * Ambos llamaban a processSubscriptionExpirations() con el mismo intervalo (1h),
 * resultando en trabajo duplicado si ambos se registraban.
 *
 * ── Por qué NO hace falta un job de cobro ────────────────────────────────────
 * Con dLocal Go, los cobros recurrentes son gestionados completamente por la
 * plataforma: dLocal Go cobra al suscriptor según la frecuencia del plan y
 * notifica al backend vía webhook (HandleWebhookUseCase).
 *
 * El único job necesario del lado del backend es subscription-expiry.job.ts,
 * que detecta suscripciones en grace_period cuyo período de gracia venció
 * sin que dLocal Go reportara un cobro exitoso, y degrada el plan.
 *
 * ── Cómo importar ────────────────────────────────────────────────────────────
 * Si necesitás forzar una verificación de vencimientos manualmente:
 *
 *   import { processSubscriptionExpirations } from "./subscription-expiry.job";
 *   await processSubscriptionExpirations();
 *
 * No usar este archivo — está preservado solo para no romper imports existentes.
 *
 * @deprecated Usar subscription-expiry.job.ts directamente.
 */

export { startSubscriptionExpiryJob as startSubscriptionRenewalJob } from "./subscription-expiry.job";
