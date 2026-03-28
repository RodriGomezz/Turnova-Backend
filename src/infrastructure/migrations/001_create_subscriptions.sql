-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: tabla subscriptions
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE subscription_status AS ENUM (
  'active',
  'past_due',
  'grace_period',
  'canceled',
  'expired'
);

CREATE TYPE subscription_plan AS ENUM (
  'pro',
  'business'
);

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan                    subscription_plan NOT NULL,
  status                  subscription_status NOT NULL DEFAULT 'active',

  -- IDs de dLocal Go
  dlocal_subscription_id  TEXT NOT NULL UNIQUE,
  dlocal_payment_id       TEXT,

  -- Período de facturación actual
  current_period_start    TIMESTAMPTZ NOT NULL,
  current_period_end      TIMESTAMPTZ NOT NULL,

  -- Gracia: populated solo cuando status = 'grace_period'
  grace_period_ends_at    TIMESTAMPTZ,

  canceled_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para las queries más frecuentes
CREATE INDEX idx_subscriptions_business_id
  ON subscriptions (business_id);

CREATE INDEX idx_subscriptions_dlocal_id
  ON subscriptions (dlocal_subscription_id);

-- Índice parcial para el cron job — solo filas en grace_period
CREATE INDEX idx_subscriptions_grace_period
  ON subscriptions (grace_period_ends_at)
  WHERE status = 'grace_period';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Solo el service role (backend) puede leer y escribir
-- El frontend nunca accede directamente a esta tabla
CREATE POLICY "service_role_all"
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Vista de conveniencia: estado de suscripción por negocio
-- Útil para queries del panel sin joins manuales
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW business_subscription AS
SELECT DISTINCT ON (s.business_id)
  s.business_id,
  s.plan,
  s.status,
  s.current_period_end,
  s.grace_period_ends_at,
  s.dlocal_subscription_id
FROM subscriptions s
ORDER BY s.business_id, s.created_at DESC;
