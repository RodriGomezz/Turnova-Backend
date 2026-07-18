-- Backfill de servicios existentes que nunca tuvieron `orden` asignado
-- (CreateServiceUseCase no lo calculaba hasta este cambio — ver
-- ReorderServicesUseCase). Sin esto, todos quedan con el valor por
-- defecto de la columna (probablemente 0), y el primer reordenamiento
-- manual partiría de un estado sin sentido.
--
-- Asigna orden secuencial por negocio, respetando el orden de creación
-- que era el criterio implícito hasta ahora (created_at ascendente).
-- El servicio genérico ("Otros / Varios") se excluye a propósito: nunca
-- se muestra en esta lista, así que su orden es irrelevante.

with ranked as (
  select
    id,
    row_number() over (
      partition by business_id
      order by created_at asc
    ) - 1 as nuevo_orden
  from services
  where es_generico = false
)
update services
set orden = ranked.nuevo_orden
from ranked
where services.id = ranked.id;
