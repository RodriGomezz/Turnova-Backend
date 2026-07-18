-- Migración 017: replace_booking_items también regenera booking_active_blocks.
--
-- Cierra el hueco que quedó pendiente en la migración 016: al reemplazar el
-- combo completo de servicios de una reserva (ModifyBookingUseCase, antes de
-- que el turno empiece), los bloques activos viejos quedaban huérfanos y los
-- nuevos nunca se creaban — para capacidad_sillas = 1 esto no rompía nada
-- (el EXCLUDE de silla seguía protegiendo el rango completo), pero para un
-- barbero con capacidad_sillas > 1 dejaba la protección de atención activa
-- desactualizada después de cualquier edición de combo.
--
-- Mismo criterio que create_booking_with_items (migración 016): si el item
-- no manda fases, todo es activo (comportamiento actual sin cambios).

CREATE OR REPLACE FUNCTION replace_booking_items(
  p_booking_id UUID,
  p_hora_fin   TIME,
  items_data   JSONB
) RETURNS bookings AS $$
DECLARE
  updated_booking     bookings;
  item                JSONB;
  v_item_start        TIMESTAMPTZ;
  v_item_active_end   TIMESTAMPTZ;
  v_item_finish_start TIMESTAMPTZ;
  v_item_end          TIMESTAMPTZ;
  v_duracion          INTEGER;
  v_activo_inicial    INTEGER;
  v_procesamiento     INTEGER;
  v_orden             INTEGER;
BEGIN
  -- La actualización de hora_fin va primero: si colisiona con otro turno del
  -- mismo barbero/silla, bookings_no_overlap_por_silla dispara acá mismo y
  -- ninguno de los DELETE/INSERT de más abajo llega a ejecutarse.
  UPDATE bookings
  SET hora_fin = p_hora_fin
  WHERE id = p_booking_id
  RETURNING * INTO updated_booking;

  DELETE FROM booking_items WHERE booking_id = p_booking_id;
  DELETE FROM booking_active_blocks WHERE booking_id = p_booking_id;

  v_item_start := updated_booking.fecha + updated_booking.hora_inicio;

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
      p_booking_id,
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
      VALUES (p_booking_id, updated_booking.barber_id, v_item_start, v_item_active_end);

      IF v_procesamiento > 0 AND v_activo_inicial + v_procesamiento < v_duracion THEN
        v_item_finish_start := v_item_active_end + (v_procesamiento || ' minutes')::interval;
        v_item_end := v_item_start + (v_duracion || ' minutes')::interval;

        INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
        VALUES (p_booking_id, updated_booking.barber_id, v_item_finish_start, v_item_end);
      END IF;
    END IF;

    v_item_start := v_item_start + (v_duracion || ' minutes')::interval;
  END LOOP;

  RETURN updated_booking;
END;
$$ LANGUAGE plpgsql;
