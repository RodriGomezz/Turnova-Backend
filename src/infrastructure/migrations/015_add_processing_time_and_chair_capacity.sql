-- Migración 015: soporte de "tiempo de procesamiento" por servicio (estilo
-- Fresha/Booksy Processing Time) y capacidad de sillas por barbero.
--
-- 100% ADITIVA. Ningún negocio ni barbero existente cambia de comportamiento
-- al correr esto:
-- - tiempo_procesamiento_minutos = 0 en todo servicio existente → el servicio
--   sigue siendo un único bloque activo de duracion_minutos, igual que hoy.
-- - capacidad_sillas = 1 en todo barbero existente → sigue permitiendo un
--   solo cliente físico sentado a la vez, igual que hoy.
--
-- Esta migración NO toca bookings_no_overlap ni ningún constraint existente.
-- Eso se hace en la migración 016, que sí cambia comportamiento y requiere
-- confirmar antes la definición exacta del constraint actual (ver nota ahí).

-- 1. Fases del servicio: cuánto es atención activa antes del procesado,
--    y cuánto dura el procesado (sin atención, ej. color fraguando).
--    El tiempo de "acabado" (activo después del procesado) es el resto:
--    duracion_minutos - tiempo_activo_inicial_minutos - tiempo_procesamiento_minutos.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS tiempo_activo_inicial_minutos INTEGER NOT NULL DEFAULT 0
    CHECK (tiempo_activo_inicial_minutos >= 0),
  ADD COLUMN IF NOT EXISTS tiempo_procesamiento_minutos INTEGER NOT NULL DEFAULT 0
    CHECK (tiempo_procesamiento_minutos >= 0);

ALTER TABLE services
  ADD CONSTRAINT services_fases_no_exceden_duracion
    CHECK (tiempo_activo_inicial_minutos + tiempo_procesamiento_minutos <= duracion_minutos);

-- CRÍTICO: Postgres no permite que el DEFAULT de una columna dependa de
-- otra columna de la misma tabla (no se puede escribir
-- "DEFAULT duracion_minutos" arriba) — por eso todo servicio que ya
-- existía queda con tiempo_activo_inicial_minutos = 0 después del ALTER
-- de arriba, lo cual significaría "0 minutos de atención al inicio" (un
-- bloque activo de duración cero, que además viola el CHECK de
-- booking_active_blocks). Este UPDATE corrige eso para que todo servicio
-- preexistente quede en su comportamiento real: 100% activo, sin fases.
UPDATE services
SET tiempo_activo_inicial_minutos = duracion_minutos
WHERE tiempo_activo_inicial_minutos = 0
  AND tiempo_procesamiento_minutos = 0;

COMMENT ON COLUMN services.tiempo_activo_inicial_minutos IS
  'Minutos de atención activa del barbero al inicio del servicio (ej. aplicar el color). 0 = todo el servicio es activo, comportamiento actual.';
COMMENT ON COLUMN services.tiempo_procesamiento_minutos IS
  'Minutos donde el cliente no necesita atención del barbero (ej. color fraguando). Durante esta ventana el barbero queda libre para otro cliente. 0 = sin ventana de procesamiento, comportamiento actual.';

-- 2. Snapshot de las fases en booking_items, con el mismo criterio que
--    nombre/precio/duracion_minutos: tomado al crear el ítem, nunca leído en
--    vivo desde services, para que un cambio posterior en el servicio no
--    altere turnos ya agendados ni reportes históricos.
ALTER TABLE booking_items
  ADD COLUMN IF NOT EXISTS tiempo_activo_inicial_minutos INTEGER NOT NULL DEFAULT 0
    CHECK (tiempo_activo_inicial_minutos >= 0),
  ADD COLUMN IF NOT EXISTS tiempo_procesamiento_minutos INTEGER NOT NULL DEFAULT 0
    CHECK (tiempo_procesamiento_minutos >= 0),
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

-- Backfill: orden según el momento de creación dentro de cada reserva.
-- Antes no existía porque nunca importó el orden secuencial de los items
-- para el cálculo de tiempo — solo se sumaban las duraciones.
WITH ordenados AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at) - 1 AS rn
  FROM booking_items
)
UPDATE booking_items bi
SET orden = o.rn
FROM ordenados o
WHERE bi.id = o.id;

-- 3. Capacidad física de sillas/estaciones que ESTE barbero puede usar en
--    simultáneo. Vive en barbers, no en businesses: un negocio puede tener
--    varios barberos, cada uno independiente hoy (por barber_id), y no todos
--    van a tener la misma cantidad de sillas disponibles.
ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS capacidad_sillas INTEGER NOT NULL DEFAULT 1
    CHECK (capacidad_sillas >= 1);

COMMENT ON COLUMN barbers.capacidad_sillas IS
  'Cantidad de sillas/estaciones físicas que este barbero puede usar en simultáneo (ej. 2 = puede tener un color procesando en una silla y atender un corte en otra). 1 = comportamiento actual, sin cambios.';
