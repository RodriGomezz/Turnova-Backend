-- Migración 021: CHECK constraint faltante en booking_items.
--
-- services ya protege esto desde la mig. 015:
--   CHECK (tiempo_activo_inicial_minutos + tiempo_procesamiento_minutos <= duracion_minutos)
--
-- booking_items — la tabla que create_booking_with_items / replace_booking_items
-- / regenerate_active_blocks realmente leen para calcular los bloques
-- activos de una reserva — nunca tuvo el mismo constraint. Hoy es
-- inofensivo porque el único camino que escribe ahí copia valores ya
-- validados desde services, pero no hay nada a nivel de base que lo
-- garantice: un futuro insert/update directo con valores inconsistentes
-- no fallaría — se comportaría silenciosamente como "sin bloque de
-- acabado" en vez de ser rechazado. Cierra ese hueco.

ALTER TABLE booking_items
  ADD CONSTRAINT booking_items_fases_no_exceden_duracion
    CHECK (tiempo_activo_inicial_minutos + tiempo_procesamiento_minutos <= duracion_minutos);
