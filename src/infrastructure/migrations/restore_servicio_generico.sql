-- Restaura el servicio genérico "Otros / Varios" que AddBookingItemUseCase
-- necesita para registrar ítems con nombre libre (cuando no se elige un
-- servicio del catálogo en el modal de "Agregar servicio" de una reserva).
--
-- Sin este registro, agregar un ítem con "O nombre libre" falla con
-- "Servicio no encontrado" — ver ServiceRepository.findGenerico.
--
-- IMPORTANTE: reemplazar 'TU_BUSINESS_ID' por el id real de tu negocio.
-- Podés obtenerlo corriendo: select id, nombre from businesses;

-- PASO 1 — Verificar primero si ya existe (puede que lo hayas desactivado
-- en vez de borrado del todo). Si esta consulta devuelve una fila, NO
-- corras el insert del paso 2 — en su lugar reactivalo:
--   update services set activo = true where id = '<el id que apareció>';
select id, nombre, activo, es_generico
from services
where business_id = 'TU_BUSINESS_ID' and es_generico = true;

-- PASO 2 — Si el paso 1 no devolvió ninguna fila (se borró por completo),
-- crear uno nuevo:
insert into services (
  business_id,
  nombre,
  descripcion,
  incluye,
  duracion_minutos,
  precio,
  precio_hasta,
  es_generico,
  activo
)
values (
  'TU_BUSINESS_ID',
  'Otros / Varios',
  null,
  null,
  1,           -- decorativo: la tabla exige duracion_minutos > 0
  0,
  null,
  true,
  true
);
