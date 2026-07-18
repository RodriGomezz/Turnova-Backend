-- Migración 016: núcleo del cambio de comportamiento.
--
-- ⚠️ VERIFICAR ANTES DE CORRER EN PRODUCCIÓN ⚠️
-- Esta migración asume que el constraint de exclusión actual sobre `bookings`
-- se llama `bookings_no_overlap` (nombre consistente en comentarios de todo
-- el backend: BookingRepository.ts, migraciones 010/011, IBookingRepository.ts).
-- No tengo acceso a tu instancia real de Supabase para confirmarlo — antes de
-- correr esto, ejecutá:
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'bookings'::regclass AND contype = 'x';
--
-- Si el nombre o las columnas del EXCLUDE difieren de lo que asumo acá,
-- avisame el resultado exacto antes de aplicar esto — corregimos la migración,
-- no la instancia real.
--
-- Qué cambia conceptualmente:
-- Antes: una reserva bloqueaba TODO su rango (hora_inicio–hora_fin) para
--        ese barbero — nadie más podía agendar con él en ese rango.
-- Ahora: se separan dos garantías distintas, cada una con su propio
--        EXCLUDE USING gist (la red de seguridad real contra condiciones de
--        carrera, igual que hoy — esto no se resuelve "a mano" en el backend):
--   1. bookings_no_overlap_por_silla: ningún barbero puede tener dos reservas
--      en la MISMA silla con rangos que se solapen (silla = recurso físico,
--      ocupada todo el tiempo, el cliente sigue sentado ahí).
--   2. booking_active_blocks_no_overlap: ningún barbero puede tener dos
--      bloques de ATENCIÓN ACTIVA que se solapen, sin importar la silla
--      (no puede cortar dos cabezas a la vez). Los huecos de procesamiento
--      (ej. color fraguando) NO generan bloque activo, así que ahí sí puede
--      atender a alguien en la otra silla.
--
-- Con capacidad_sillas = 1 (default, todo barbero existente), chair_slot es
-- siempre 1 y cada servicio sin fases genera un solo bloque activo = toda
-- su duración → el resultado es EXACTAMENTE igual al comportamiento actual.
-- Nada cambia para ningún negocio hasta que alguien suba capacidad_sillas
-- y configure tiempo_procesamiento_minutos en al menos un servicio.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Silla asignada a la reserva. 1 = comportamiento actual para todos.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS chair_slot INTEGER NOT NULL DEFAULT 1
    CHECK (chair_slot >= 1);

-- 2. Reemplazar el constraint viejo (barber_id + rango completo) por uno
--    que agrega chair_slot a la igualdad. Para capacidad_sillas = 1 esto
--    es matemáticamente idéntico al constraint viejo.
-- ⚠️ VERIFICADO CONTRA LA INSTANCIA REAL (respuesta del usuario, confirma
-- nombre y forma exacta de bookings_no_overlap):
--
--   EXCLUDE USING gist (
--     barber_id WITH =,
--     fecha WITH =,
--     tsrange(
--       (fecha)::timestamp without time zone + (hora_inicio)::interval,
--       (fecha)::timestamp without time zone + (hora_fin)::interval,
--       '[)'
--     ) WITH &&
--   ) WHERE ((estado)::text <> 'cancelada'::text)
--
-- Diferencia importante contra lo que yo había asumido: el original también
-- incluye `fecha WITH =` como columna de igualdad (no solo barber_id). La
-- migración de abajo ya está corregida para incluirla también en
-- bookings_no_overlap_por_silla — sin esto, el nuevo constraint hubiera sido
-- una reproducción infiel del actual para capacidad_sillas = 1.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap_por_silla
  EXCLUDE USING gist (
    barber_id WITH =,
    fecha WITH =,
    chair_slot WITH =,
    tsrange(
      (fecha)::timestamp without time zone + (hora_inicio)::interval,
      (fecha)::timestamp without time zone + (hora_fin)::interval,
      '[)'
    ) WITH &&
  ) WHERE ((estado)::text <> 'cancelada'::text);

-- 3. Bloques de atención activa real del barbero — la pieza nueva que hace
--    posible el "color procesando + corte en paralelo". Se generan en el
--    backend (create_booking_with_items / replace_booking_items más abajo),
--    nunca a mano: un item con tiempo_procesamiento_minutos = 0 genera un
--    solo bloque igual a toda su duración (comportamiento actual sin cambios).
CREATE TABLE IF NOT EXISTS booking_active_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  barber_id  UUID NOT NULL REFERENCES barbers(id),
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_booking_active_blocks_booking_id
  ON booking_active_blocks(booking_id);

ALTER TABLE booking_active_blocks
  ADD CONSTRAINT booking_active_blocks_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  );

-- 4. Backfill: generar un bloque activo (= duración completa) para cada
--    booking_item existente, ya que todos tienen tiempo_procesamiento_minutos
--    = 0 (default de la migración 015) y por lo tanto son 100% activos.
--    Se calculan los offsets acumulados dentro de cada reserva usando `orden`
--    (ya backfilleado en 015 según created_at).
--
--    CRÍTICO: se excluyen las reservas canceladas. booking_active_blocks_no_overlap
--    no puede filtrar por estado en su WHERE (un EXCLUDE constraint no puede
--    mirar columnas de otra tabla), así que si generáramos bloques para
--    turnos cancelados y dos de ellos históricamente se superponían para el
--    mismo barbero (algo casi seguro que pasó alguna vez), este INSERT
--    fallaría acá mismo y toda la migración no podría aplicarse.
--
--    También se excluyen reservas con barber_id nulo — booking_active_blocks
--    exige barber_id NOT NULL (toda reserva nueva siempre tiene barbero
--    asignado), pero pueden existir turnos históricos huérfanos (ej. de un
--    barbero borrado hace tiempo) sin uno. Esas reservas puntuales quedan
--    sin bloque activo generado — mismo nivel de protección que ya tenían
--    antes de esta migración (ninguno, al no tener barbero identificable no
--    hay agenda de barbero que proteger).
WITH items_con_offset AS (
  SELECT
    bi.id,
    bi.booking_id,
    b.barber_id,
    b.fecha,
    b.hora_inicio,
    bi.duracion_minutos,
    COALESCE(
      SUM(bi.duracion_minutos) OVER (
        PARTITION BY bi.booking_id ORDER BY bi.orden
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS minutos_previos
  FROM booking_items bi
  JOIN bookings b ON b.id = bi.booking_id
  WHERE bi.duracion_minutos > 0
    AND (b.estado)::text <> 'cancelada'::text
    AND b.barber_id IS NOT NULL
)
INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
SELECT
  booking_id,
  barber_id,
  (fecha + hora_inicio) + (minutos_previos || ' minutes')::interval,
  (fecha + hora_inicio) + ((minutos_previos + duracion_minutos) || ' minutes')::interval
FROM items_con_offset;

-- 5. Reescribir create_booking_with_items: ahora elige silla automáticamente
--    (reintentando 1..capacidad_sillas dentro de la misma transacción, igual
--    que el patrón de reintento que ya usás en el backend para conflictos)
--    y genera los booking_active_blocks de cada item según sus fases.
CREATE OR REPLACE FUNCTION create_booking_with_items(
  booking_data JSONB,
  items_data JSONB
) RETURNS bookings AS $$
DECLARE
  new_booking       bookings;
  item              JSONB;
  v_capacidad_sillas INTEGER;
  v_chair_slot       INTEGER;
  v_inserted         BOOLEAN := false;
  v_fecha            DATE := (booking_data->>'fecha')::date;
  v_hora_inicio      TIME := (booking_data->>'hora_inicio')::time;
  v_item_start       TIMESTAMPTZ;
  v_item_active_end  TIMESTAMPTZ;
  v_item_finish_start TIMESTAMPTZ;
  v_item_end         TIMESTAMPTZ;
  v_duracion         INTEGER;
  v_activo_inicial   INTEGER;
  v_procesamiento    INTEGER;
  v_orden            INTEGER;
BEGIN
  SELECT capacidad_sillas INTO v_capacidad_sillas
  FROM barbers WHERE id = (booking_data->>'barber_id')::uuid;

  IF v_capacidad_sillas IS NULL THEN
    v_capacidad_sillas := 1;
  END IF;

  FOR v_chair_slot IN 1..v_capacidad_sillas LOOP
    BEGIN
      INSERT INTO bookings (
        business_id, barber_id, cliente_nombre, cliente_email, cliente_telefono,
        fecha, hora_inicio, hora_fin, estado, cancellation_token, chair_slot
      )
      SELECT
        (booking_data->>'business_id')::uuid,
        (booking_data->>'barber_id')::uuid,
        booking_data->>'cliente_nombre',
        booking_data->>'cliente_email',
        booking_data->>'cliente_telefono',
        v_fecha,
        v_hora_inicio,
        (booking_data->>'hora_fin')::time,
        booking_data->>'estado',
        gen_random_uuid(),
        v_chair_slot
      RETURNING * INTO new_booking;

      v_inserted := true;
      EXIT;
    EXCEPTION WHEN exclusion_violation THEN
      -- Esta silla ya está ocupada en ese rango para este barbero — probar la siguiente.
      CONTINUE;
    END;
  END LOOP;

  IF NOT v_inserted THEN
    RAISE EXCEPTION 'No hay silla disponible para este barbero en ese horario'
      USING ERRCODE = 'exclusion_violation';
  END IF;

  v_item_start := v_fecha + v_hora_inicio;

  FOR item IN
    SELECT value FROM jsonb_array_elements(items_data)
    ORDER BY COALESCE((value->>'orden')::int, 0)
  LOOP
    v_duracion       := (item->>'duracion_minutos')::integer;
    v_orden          := COALESCE((item->>'orden')::integer, 0);
    -- Si el item no manda fases explícitas, todo el servicio es activo
    -- (comportamiento actual, sin cambios).
    v_activo_inicial := COALESCE((item->>'tiempo_activo_inicial_minutos')::integer, v_duracion);
    v_procesamiento  := COALESCE((item->>'tiempo_procesamiento_minutos')::integer, 0);

    INSERT INTO booking_items (
      booking_id, service_id, nombre, precio, duracion_minutos,
      tiempo_activo_inicial_minutos, tiempo_procesamiento_minutos, orden
    )
    VALUES (
      new_booking.id,
      (item->>'service_id')::uuid,
      item->>'nombre',
      (item->>'precio')::numeric,
      v_duracion,
      v_activo_inicial,
      v_procesamiento,
      v_orden
    );

    IF v_duracion > 0 THEN
      -- Bloque activo #1 (aplicación, o el servicio entero si no tiene fases).
      v_item_active_end := v_item_start + (v_activo_inicial || ' minutes')::interval;

      INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
      VALUES (new_booking.id, new_booking.barber_id, v_item_start, v_item_active_end);

      -- Bloque activo #2 (acabado), solo si hay procesamiento Y queda tiempo
      -- activo después de él.
      IF v_procesamiento > 0 AND v_activo_inicial + v_procesamiento < v_duracion THEN
        v_item_finish_start := v_item_active_end + (v_procesamiento || ' minutes')::interval;
        v_item_end := v_item_start + (v_duracion || ' minutes')::interval;

        INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
        VALUES (new_booking.id, new_booking.barber_id, v_item_finish_start, v_item_end);
      END IF;
    END IF;

    -- El siguiente item de la reserva empieza donde termina este (secuencial).
    v_item_start := v_item_start + (v_duracion || ' minutes')::interval;
  END LOOP;

  INSERT INTO booking_tickets (booking_id, estado)
  VALUES (new_booking.id, 'abierto');

  RETURN new_booking;
END;
$$ LANGUAGE plpgsql;
