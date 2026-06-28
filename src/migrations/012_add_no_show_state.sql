-- Migración 012: agrega el estado "no_show" a bookings.
--
-- Antes solo existían pendiente/confirmada/cancelada/modificada. No había
-- forma de distinguir "el cliente avisó y canceló con tiempo" de "no avisó
-- y no vino" — ambos casos quedaban indistinguibles, y peor: si el negocio
-- marcaba "cancelada" para sacarlo de ingresos, perdía el dato de que fue
-- una inasistencia (útil para detectar clientes problemáticos a futuro).
--
-- no_show_at sigue el mismo patrón ya usado para cancelled_at: timestamp
-- de auditoría, no un simple booleano, para saber cuándo se marcó.

-- 1. Columna nueva. Nullable — solo se completa cuando estado = 'no_show'.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;

-- 2. Si bookings.estado tiene un CHECK constraint con una lista cerrada de
--    valores (creado fuera de este historial de migraciones, antes de la
--    migración 008), hay que relajarlo para admitir 'no_show'. Este bloque
--    es defensivo: busca cualquier CHECK constraint sobre la columna
--    "estado" de "bookings" y lo recrea incluyendo 'no_show'. Si no existe
--    ningún constraint (la columna es TEXT libre), no hace nada.
--
-- IMPORTANTE: revisar el nombre real del constraint en producción antes de
-- correr esto — la introspección automática vía information_schema cubre
-- el caso común (un solo CHECK sobre la columna), pero si el constraint
-- tiene una forma distinta (ej. combinado con otra columna), hay que
-- ajustarlo a mano.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid
  WHERE rel.relname = 'bookings'
    AND con.contype = 'c'
    AND con.conkey @> ARRAY[att.attnum]
    AND att.attname = 'estado';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE bookings
    ADD CONSTRAINT bookings_estado_check
    CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'modificada', 'no_show'));
END $$;

-- 3. Índice parcial para la futura agregación "clientes con no-shows
--    frecuentes" (no implementada todavía, pero la columna ya queda lista
--    para esa consulta sin tener que migrar de nuevo).
CREATE INDEX IF NOT EXISTS idx_bookings_no_show
  ON bookings (business_id, cliente_email)
  WHERE estado = 'no_show';
