-- Migración 018: regenerate_active_blocks(booking_id).
--
-- Cierra el último hueco encontrado en ModifyBookingUseCase: al reprogramar
-- una reserva (cambiar fecha/hora/barbero) SIN reemplazar el combo de
-- servicios, replaceItems nunca se llamaba — los booking_active_blocks
-- quedaban apuntando al horario y barbero VIEJOS. Para capacidad_sillas = 1
-- esto no rompía nada visible (el camino rápido de disponibilidad ni
-- siquiera lee booking_active_blocks), pero sí dejaba basura que podía
-- chocar más adelante contra booking_active_blocks_no_overlap si alguien
-- reservaba justo ese horario viejo con ese barbero de nuevo — el mismo
-- tipo de "conflicto fantasma" que ya vimos con la cancelación.
--
-- A diferencia de create_booking_with_items / replace_booking_items, esta
-- función no recibe items por parámetro — los relee directamente de
-- booking_items (ya tienen orden y fases guardadas desde que se crearon).
-- Se llama DESPUÉS de que ModifyBookingUseCase ya actualizó fecha/hora_inicio/
-- barber_id en la fila de bookings, así que lee el horario ya correcto.

CREATE OR REPLACE FUNCTION regenerate_active_blocks(p_booking_id UUID) RETURNS void AS $$
DECLARE
  b                    bookings%rowtype;
  item                 booking_items%rowtype;
  v_item_start         TIMESTAMPTZ;
  v_item_active_end    TIMESTAMPTZ;
  v_item_finish_start  TIMESTAMPTZ;
  v_item_end           TIMESTAMPTZ;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva % no encontrada', p_booking_id;
  END IF;

  DELETE FROM booking_active_blocks WHERE booking_id = p_booking_id;

  v_item_start := b.fecha + b.hora_inicio;

  FOR item IN
    SELECT * FROM booking_items WHERE booking_id = p_booking_id ORDER BY orden
  LOOP
    IF item.duracion_minutos > 0 THEN
      v_item_active_end := v_item_start + (item.tiempo_activo_inicial_minutos || ' minutes')::interval;

      INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
      VALUES (p_booking_id, b.barber_id, v_item_start, v_item_active_end);

      IF item.tiempo_procesamiento_minutos > 0
         AND item.tiempo_activo_inicial_minutos + item.tiempo_procesamiento_minutos < item.duracion_minutos
      THEN
        v_item_finish_start := v_item_active_end + (item.tiempo_procesamiento_minutos || ' minutes')::interval;
        v_item_end := v_item_start + (item.duracion_minutos || ' minutes')::interval;

        INSERT INTO booking_active_blocks (booking_id, barber_id, starts_at, ends_at)
        VALUES (p_booking_id, b.barber_id, v_item_finish_start, v_item_end);
      END IF;
    END IF;

    v_item_start := v_item_start + (item.duracion_minutos || ' minutes')::interval;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
