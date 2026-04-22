-- Ajustes para checkout pendiente y plan Starter en subscriptions
-- Ejecutar en Supabase SQL Editor después de la migración 001

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'starter';

ALTER TABLE subscriptions
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN current_period_start DROP NOT NULL,
  ALTER COLUMN current_period_end DROP NOT NULL;

DROP VIEW IF EXISTS business_subscription;

CREATE VIEW business_subscription AS
SELECT DISTINCT ON (s.business_id)
  s.business_id,
  s.plan,
  s.status,
  s.current_period_end,
  s.grace_period_ends_at,
  s.dlocal_subscription_id
FROM subscriptions s
ORDER BY
  s.business_id,
  CASE
    WHEN s.status IN ('active', 'past_due', 'grace_period') THEN 0
    WHEN s.status = 'pending' THEN 1
    ELSE 2
  END,
  s.created_at DESC;
