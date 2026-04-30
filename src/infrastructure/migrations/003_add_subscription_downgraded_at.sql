-- Migración: agregar subscription_downgraded_at a businesses
-- Ejecutar en Supabase SQL Editor después de las migraciones 001 y 002
--
-- Este campo distingue un negocio con plan Starter "original" (nunca tuvo
-- suscripción pagada) de uno "degradado" (tuvo una suscripción que venció
-- o cuya gracia expiró). getBusinessStatus() lo usa para retornar
-- "subscription_expired" y bloquear el acceso al negocio.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_downgraded_at TIMESTAMPTZ DEFAULT NULL;

-- Índice parcial para acelerar consultas de negocios degradados
CREATE INDEX IF NOT EXISTS idx_businesses_subscription_downgraded
  ON businesses (subscription_downgraded_at)
  WHERE subscription_downgraded_at IS NOT NULL;

COMMENT ON COLUMN businesses.subscription_downgraded_at IS
  'Fecha en que el cron job degradó el plan a Starter por suscripción vencida o gracia expirada. '
  'NULL = nunca tuvo suscripción pagada (Starter original). '
  'NOT NULL = tuvo suscripción que venció — el negocio no puede operar hasta renovar.';
