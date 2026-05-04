-- Campos para recurring con tarjetas tokenizadas por Smart Fields
-- Ejecutar despues de la migracion 003

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS dlocal_card_id text,
  ADD COLUMN IF NOT EXISTS dlocal_card_brand text,
  ADD COLUMN IF NOT EXISTS dlocal_card_last4 text,
  ADD COLUMN IF NOT EXISTS dlocal_network_tx_reference text,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS payer_document text;
