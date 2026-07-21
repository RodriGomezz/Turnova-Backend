-- Migración 022: booking_items.service_id nullable — elimina la necesidad
-- del servicio "genérico" ("Otros / Varios") como placeholder de FK.
--
-- CONTEXTO:
-- Migración 008 agregó es_generico porque booking_items.service_id era
-- NOT NULL y necesitábamos algo a lo que apuntar cuando el barbero carga
-- un ítem con nombre libre (producto o adicional que no está en el
-- catálogo). Eso obligó a: (1) crear un servicio fantasma por negocio con
-- duracion_minutos=1 decorativo para esquivar el CHECK > 0 de services,
-- (2) filtrar es_generico en cada listado de servicios del frontend, y
-- (3) un service "Otros / Varios" con precio $0 que además se filtró de
-- colarse en el selector "Del catálogo" del panel (services.activo=true
-- no lo excluía). Ya tuvimos un incidente en producción por esto —ver
-- restore_servicio_generico.sql— cuando ese registro se borró a mano y
-- rompió el alta de ítems libres para ese negocio.
--
-- El resto de la industria (Vagaro "Custom Service", Square "Custom Item")
-- resuelve esto con un ítem ad-hoc real: sin service_id, nombre y precio
-- propios. Es lo que esta migración habilita.
--
-- Esta migración NO borra los servicios genéricos existentes ni los
-- booking_items históricos que los referencian — son datos reales, romper
-- esa FK rompería reportes viejos. Solo los desactiva para que dejen de
-- ofrecerse hacia adelante, y deja de exigir el placeholder para ítems nuevos.

BEGIN;

-- 1. service_id deja de ser obligatorio: un ítem libre ahora puede no
--    apuntar a ningún servicio de catálogo.
ALTER TABLE booking_items ALTER COLUMN service_id DROP NOT NULL;

-- 2. nombre ya es NOT NULL desde el 008 — eso alcanza a nivel de base.
--    La regla de negocio real ("si no hay service_id, nombre_personalizado
--    es obligatorio") se valida en la capa de aplicación (ver
--    addBookingItemSchema y AddBookingItemUseCase), no acá: es una regla
--    sobre el INPUT del caso de uso, no sobre el estado final de la fila.

-- 3. Desactivar los servicios genéricos existentes — dejan de aparecer en
--    cualquier selector de servicios activos (incluido el bug real: el
--    selector "Del catálogo" del panel de turnos no filtraba es_generico,
--    solo activo). No se borran: booking_items históricos siguen
--    resolviendo su FK correctamente.
UPDATE services SET activo = false WHERE es_generico = true;

COMMIT;

-- NOTA: no se elimina la columna es_generico ni el índice único asociado
-- en esta migración — quedan como metadata histórica inofensiva. Se puede
-- limpiar en una migración futura una vez confirmado que nada los lee.
