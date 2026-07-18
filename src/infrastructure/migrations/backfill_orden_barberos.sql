-- Backfill de profesionales existentes que puedan no tener `orden`
-- asignado correctamente (a diferencia de `services`, esta columna ya
-- existía y CreateBarberUseCase no la calculaba automáticamente hasta
-- este cambio — puede que varios negocios tengan todos sus barberos en
-- el mismo valor por defecto).
--
-- Asigna orden secuencial por negocio, respetando el orden de creación
-- (created_at ascendente) — mismo criterio usado en el backfill de
-- servicios. Seguro de correr aunque ya tengan un orden razonable: solo
-- reasigna según created_at, no destruye nada si ya estaba bien.

with ranked as (
  select
    id,
    row_number() over (
      partition by business_id
      order by created_at asc
    ) - 1 as nuevo_orden
  from barbers
)
update barbers
set orden = ranked.nuevo_orden
from ranked
where barbers.id = ranked.id;
