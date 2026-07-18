-- Migración 010: función RPC para crear booking + booking_items + booking_ticket
-- en una sola transacción de Postgres.
--
-- Por qué hace falta: supabase-js no da transacciones atómicas multi-tabla
-- desde el cliente. Sin esto, un fallo a mitad de camino (ej: el insert de
-- items falla después de insertar el booking) deja datos huérfanos.
--
-- El constraint de no-overlap (bookings_no_overlap, EXCLUDE USING gist) sigue
-- viviendo en la tabla bookings y se evalúa en el INSERT de más abajo —
-- esta función no lo reemplaza ni lo duplica, solo lo envuelve en una
-- transacción que también cubre booking_items y booking_tickets.

CREATE OR REPLACE FUNCTION create_booking_with_items(
  booking_data JSONB,
  items_data JSONB
) RETURNS bookings AS $$
DECLARE
  new_booking bookings;
  item JSONB;
BEGIN
  INSERT INTO bookings (
    business_id, barber_id, cliente_nombre, cliente_email, cliente_telefono,
    fecha, hora_inicio, hora_fin, estado, cancellation_token
  )
  SELECT
    (booking_data->>'business_id')::uuid,
    (booking_data->>'barber_id')::uuid,
    booking_data->>'cliente_nombre',
    booking_data->>'cliente_email',
    booking_data->>'cliente_telefono',
    (booking_data->>'fecha')::date,
    (booking_data->>'hora_inicio')::time,
    (booking_data->>'hora_fin')::time,
    booking_data->>'estado',
    encode(gen_random_bytes(16), 'hex')
  RETURNING * INTO new_booking;
  -- Si bookings_no_overlap detecta colisión, levanta 23P01 acá mismo,
  -- antes de insertar ningún item — la transacción completa hace rollback,
  -- no quedan booking_items ni booking_tickets huérfanos.

  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO booking_items (booking_id, service_id, nombre, precio, duracion_minutos)
    VALUES (
      new_booking.id,
      (item->>'service_id')::uuid,
      item->>'nombre',
      (item->>'precio')::numeric,
      (item->>'duracion_minutos')::integer
    );
  END LOOP;

  INSERT INTO booking_tickets (booking_id, estado)
  VALUES (new_booking.id, 'abierto');

  RETURN new_booking;
END;
$$ LANGUAGE plpgsql;
