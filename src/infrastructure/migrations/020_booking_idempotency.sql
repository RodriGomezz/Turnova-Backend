-- Migración 020: idempotencia en la creación de reservas.
--
-- Problema que cierra: create_booking_with_items (mig. 016) reintenta
-- automáticamente la silla siguiente (chair_slot) cuando la primera está
-- ocupada — correcto para dos CLIENTES distintos pidiendo turno con el
-- mismo barbero en simultáneo. Pero el mismo mecanismo no distingue eso de
-- "el mismo cliente mandó el mismo pedido dos veces" (doble click que se
-- coló antes de que el botón se deshabilite, o un timeout de red donde el
-- cliente reintenta manualmente porque nunca vio la respuesta del primer
-- intento). Con capacidad_sillas = 1 esto quedaba protegido por el EXCLUDE
-- constraint casi por accidente (el segundo intento no tiene otra silla que
-- probar y falla limpio) — pero deja de estar protegido apenas algún
-- barbero pase a capacidad_sillas > 1: el segundo intento simplemente
-- encuentra la silla 2 libre y crea una reserva real duplicada.
--
-- Solución: idempotency_key generada UNA VEZ por el cliente (frontend) al
-- entrar al paso de confirmación — no en cada click. Se manda en cada
-- intento (incluidos los reintentos). La función, antes de tocar sillas,
-- devuelve la reserva ya creada si la key ya existe, en vez de crear una
-- nueva. Retrocompatible: si booking_data no trae idempotency_key (backend
-- viejo todavía no actualizado, o un caller que decide no usarla), la
-- función se comporta exactamente igual que antes — cero cambio de
-- comportamiento sin el campo.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- Único índice que hace falta: unicidad global de la key, no por negocio,
-- porque la genera el cliente con crypto.randomUUID() — la probabilidad de
-- colisión entre dos negocios distintos es la misma que la de cualquier
-- otro UUID v4, irrelevante en la práctica.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency_key
  ON bookings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN bookings.idempotency_key IS
  'UUID generado por el cliente una sola vez por intento de reserva (no por request HTTP) — permite detectar reintentos del mismo pedido y devolver la reserva ya creada en vez de duplicarla. NULL = caller no la mandó (comportamiento previo a esta migración, sin protección de idempotencia).';

CREATE OR REPLACE FUNCTION create_booking_with_items(
  booking_data JSONB,
  items_data JSONB
) RETURNS bookings AS $$
DECLARE
  new_booking        bookings;
  existing_booking    bookings;
  item                JSONB;
  v_capacidad_sillas  INTEGER;
  v_chair_slot        INTEGER;
  v_inserted          BOOLEAN := false;
  v_fecha             DATE := (booking_data->>'fecha')::date;
  v_hora_inicio       TIME := (booking_data->>'hora_inicio')::time;
  -- NULLIF vacío -> NULL: booking_data->>'idempotency_key' devuelve NULL si
  -- la clave no está en el JSONB, pero también podría venir como string
  -- vacío desde algún caller descuidado — este NULLIF cubre ambos casos
  -- antes del cast a uuid (::uuid sobre '' lanza error de sintaxis, no NULL).
  v_idempotency_key   UUID := NULLIF(booking_data->>'idempotency_key', '')::uuid;
  v_item_start        TIMESTAMPTZ;
  v_item_active_end   TIMESTAMPTZ;
  v_item_finish_start TIMESTAMPTZ;
  v_item_end          TIMESTAMPTZ;
  v_duracion          INTEGER;
  v_activo_inicial    INTEGER;
  v_procesamiento     INTEGER;
  v_orden             INTEGER;
BEGIN
  -- Camino rápido de idempotencia: si ya existe una reserva con esta key,
  -- devolverla tal cual en vez de crear una nueva. Cubre el caso normal
  -- (sin condición de carrera) de un reintento que llega después de que el
  -- primer intento ya terminó de commitear.
  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO existing_booking FROM bookings WHERE idempotency_key = v_idempotency_key;
    IF FOUND THEN
      RETURN existing_booking;
    END IF;
  END IF;

  SELECT capacidad_sillas INTO v_capacidad_sillas
  FROM barbers WHERE id = (booking_data->>'barber_id')::uuid;

  IF v_capacidad_sillas IS NULL THEN
    v_capacidad_sillas := 1;
  END IF;

  FOR v_chair_slot IN 1..v_capacidad_sillas LOOP
    BEGIN
      INSERT INTO bookings (
        business_id, barber_id, cliente_nombre, cliente_email, cliente_telefono,
        fecha, hora_inicio, hora_fin, estado, cancellation_token, chair_slot,
        idempotency_key
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
        v_chair_slot,
        v_idempotency_key
      RETURNING * INTO new_booking;

      v_inserted := true;
      EXIT;
    EXCEPTION
      WHEN exclusion_violation THEN
        -- Esta silla ya está ocupada en ese rango para este barbero — probar la siguiente.
        CONTINUE;
      WHEN unique_violation THEN
        -- Carrera real: dos requests con la MISMA idempotency_key llegaron
        -- en simultáneo y ambas pasaron el chequeo de arriba antes de que
        -- cualquiera hiciera commit. Esta es la que perdió la carrera de
        -- inserción — no es un conflicto de horario, es el mismo pedido
        -- duplicado a nivel de red. Devolvemos la reserva que sí ganó.
        IF v_idempotency_key IS NOT NULL THEN
          SELECT * INTO existing_booking FROM bookings WHERE idempotency_key = v_idempotency_key;
          IF FOUND THEN
            RETURN existing_booking;
          END IF;
        END IF;
        RAISE;
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
      v_item_active_end := v_item_start + (v_activo_inicial || ' minutes')::interval;

      INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
      VALUES (new_booking.id, new_booking.barber_id, v_item_start, v_item_active_end);

      IF v_procesamiento > 0 AND v_activo_inicial + v_procesamiento < v_duracion THEN
        v_item_finish_start := v_item_active_end + (v_procesamiento || ' minutes')::interval;
        v_item_end := v_item_start + (v_duracion || ' minutes')::interval;

        INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
        VALUES (new_booking.id, new_booking.barber_id, v_item_finish_start, v_item_end);
      END IF;
    END IF;

    v_item_start := v_item_start + (v_duracion || ' minutes')::interval;
  END LOOP;

  INSERT INTO booking_tickets (booking_id, estado)
  VALUES (new_booking.id, 'abierto');

  RETURN new_booking;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────
-- Nota sobre replace_booking_items (mig. 017): NO necesita el mismo
-- tratamiento. Su primer statement es
--   UPDATE bookings SET hora_fin = p_hora_fin WHERE id = p_booking_id
-- y un UPDATE toma un lock exclusivo de fila en Postgres por el resto de
-- la transacción — un segundo llamado concurrente sobre el MISMO
-- booking_id se bloquea en su propio UPDATE hasta que el primero
-- termina (commit o rollback), así que el DELETE+INSERT de booking_items
-- que sigue ya está serializado por esa lock, sin necesitar un SELECT
-- ... FOR UPDATE explícito. No se toca esa función en esta migración.
-- ─────────────────────────────────────────────────────────────────────────
