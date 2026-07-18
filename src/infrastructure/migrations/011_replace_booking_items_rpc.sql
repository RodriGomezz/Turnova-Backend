-- Migración 011: función RPC para reemplazar el combo de servicios de una
-- reserva existente (modificar antes de que empiece, no agregar in-situ —
-- ver AddBookingItemUseCase para ese otro caso).
--
-- Por qué hace falta una función dedicada y no un DELETE + INSERT sueltos
-- desde la aplicación: si el INSERT de los nuevos items fallara después del
-- DELETE de los viejos, la reserva quedaría sin ningún servicio asociado.
-- Esta función envuelve ambos pasos, más la actualización de hora_fin, en
-- una sola transacción de Postgres.

CREATE OR REPLACE FUNCTION replace_booking_items(
  p_booking_id UUID,
  p_hora_fin   TIME,
  items_data   JSONB
) RETURNS bookings AS $$
DECLARE
  updated_booking bookings;
  item JSONB;
BEGIN
  DELETE FROM booking_items WHERE booking_id = p_booking_id;

  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO booking_items (booking_id, service_id, nombre, precio, duracion_minutos)
    VALUES (
      p_booking_id,
      (item->>'service_id')::uuid,
      item->>'nombre',
      (item->>'precio')::numeric,
      (item->>'duracion_minutos')::integer
    );
  END LOOP;

  UPDATE bookings
  SET hora_fin = p_hora_fin
  WHERE id = p_booking_id
  RETURNING * INTO updated_booking;
  -- Si la nueva hora_fin colisiona con otro turno del mismo barbero,
  -- bookings_no_overlap dispara 23P01 acá — toda la transacción (incluidos
  -- los DELETE/INSERT de items de arriba) hace rollback, no queda el
  -- combo nuevo a medio aplicar con una agenda inconsistente.

  RETURN updated_booking;
END;
$$ LANGUAGE plpgsql;
