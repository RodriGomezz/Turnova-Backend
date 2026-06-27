-- Migración 009: backfill de datos existentes para el modelo multi-servicio
--
-- IMPORTANTE — correr en este orden exacto, en una sola transacción si es posible:
--   1. Crear el servicio genérico de cada negocio que no lo tenga.
--   2. Crear booking_items a partir del bookings.service_id actual (1 fila por booking).
--   3. Crear booking_tickets en estado 'abierto' para reservas activas, 'cobrado'
--      para las que ya tienen información de pago si existe (ver nota abajo).
--
-- LIMITACIÓN CONOCIDA, sin solución posible:
-- nombre y precio se copian del service ACTUAL (services.nombre, services.precio),
-- no del precio que realmente se cobró en el pasado. Si el negocio cambió precios
-- desde que se creó alguna de estas reservas, los reportes históricos de ese
-- período van a reflejar el precio de hoy, no el que se cobró en su momento.
-- Este dato nunca se guardó antes de esta migración, así que no es recuperable.

BEGIN;

-- 1. Servicio genérico por negocio (idempotente — no duplica si ya corrió antes)
--    duracion_minutos = 1, no 0: la tabla services tiene un CHECK constraint
--    (services_duracion_check: duracion_minutos > 0) que prohíbe el cero.
--    Este valor es decorativo en el catálogo — AddBookingItemUseCase nunca
--    lo lee para decidir si un booking_item ocupa agenda; usa el
--    duracion_minutos que el barbero ingresa al agregar el ítem, que puede
--    ser 0 sin problema (booking_items no tiene ese constraint).
INSERT INTO services (
  business_id, nombre, descripcion, incluye, duracion_minutos,
  precio, precio_hasta, activo, es_generico
)
SELECT
  b.id, 'Otros / Varios', NULL, NULL, 1, 0, NULL, true, true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM services s WHERE s.business_id = b.id AND s.es_generico = true
);

-- 2. booking_items a partir del modelo viejo (1 fila por booking existente)
INSERT INTO booking_items (booking_id, service_id, nombre, precio, duracion_minutos, created_at)
SELECT
  bk.id,
  bk.service_id,
  s.nombre,
  s.precio,
  s.duracion_minutos,
  bk.created_at
FROM bookings bk
JOIN services s ON s.id = bk.service_id
WHERE NOT EXISTS (
  SELECT 1 FROM booking_items bi WHERE bi.booking_id = bk.id
);

-- 3. booking_tickets — todas las reservas existentes arrancan en 'abierto'.
--    No hay forma de saber retroactivamente cuáles ya fueron cobradas
--    porque el sistema no registraba esa información antes de esta migración;
--    el negocio puede cerrar manualmente las que correspondan desde el panel.
INSERT INTO booking_tickets (booking_id, estado)
SELECT bk.id, 'abierto'
FROM bookings bk
WHERE NOT EXISTS (
  SELECT 1 FROM booking_tickets bt WHERE bt.booking_id = bk.id
);

COMMIT;
