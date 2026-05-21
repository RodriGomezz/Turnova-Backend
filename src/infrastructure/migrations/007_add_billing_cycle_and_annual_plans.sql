-- Migration 007: Agregar ciclo de facturación y soporte para planes anuales
-- 
-- Cambios:
--   1. Nueva columna billing_cycle en subscriptions (monthly | annual)
--   2. Índice para búsquedas por billing_cycle
--
-- Nota sobre trial:
--   El cambio de 30 → 14 días de prueba es puramente a nivel de aplicación
--   (TRIAL_DAYS en plan-prices.ts). Los negocios con trial_ends_at ya seteado
--   a 30 días NO se ven afectados (respetan el período original prometido).

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_cycle
  ON subscriptions (billing_cycle);

COMMENT ON COLUMN subscriptions.billing_cycle IS
  'Ciclo de facturación: monthly (mensual recurrente) | annual (un cobro anual)';
