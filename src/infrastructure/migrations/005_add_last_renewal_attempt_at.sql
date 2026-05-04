-- Timestamp del ultimo intento automatico de renovacion
-- Ejecutar despues de la migracion 004

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_renewal_attempt_at timestamptz;
