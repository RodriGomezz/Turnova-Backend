-- La columna `orden` nunca existió en `services` — a diferencia de
-- `barbers`, que sí la tiene. Se asumió por simetría que estaba, pero el
-- error 42703 al correr el backfill confirma que falta crearla primero.
--
-- Se agrega con DEFAULT 0 para que cualquier INSERT existente sin este
-- campo no rompa; el backfill posterior (backfill_orden_servicios.sql) le
-- asigna un valor secuencial real basado en created_at.

alter table services
  add column if not exists orden integer not null default 0;
