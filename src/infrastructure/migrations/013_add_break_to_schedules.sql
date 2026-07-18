-- Migración 013: agrega descanso (break) opcional a schedules.
--
-- Hasta ahora un schedule solo modelaba un bloque continuo de atención
-- (hora_inicio → hora_fin). No existía forma de declarar un corte intermedio
-- (almuerzo, colación) sin partir el turno en dos filas — y el unique
-- constraint (business_id, barber_id, dia_semana) lo impedía directamente.
--
-- Se eligió un único par break_start/break_end por fila en lugar de una
-- tabla separada de "breaks": una barbería tiene como mucho un descanso por
-- día en el caso real (almuerzo). Múltiples columnas nullable son
-- suficientes y evitan un join adicional en el hot path de cálculo de slots
-- (GetAvailableSlotsUseCase / GetAllSlotsForDaysUseCase / GetAvailableDaysUseCase).
--
-- Ambas columnas son nullable: NULL en cualquiera de las dos significa
-- "sin descanso ese día". La consistencia (break dentro del horario, orden
-- correcto) se valida en la capa de aplicación (zod schema), no acá, para
-- mantener el mismo criterio que el resto del dominio de schedules.

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS break_start TIME,
  ADD COLUMN IF NOT EXISTS break_end   TIME;

-- CHECK defensivo a nivel de BD: si break_start está, break_end también
-- debe estarlo (y viceversa), y el orden debe ser correcto. No valida que
-- el break caiga dentro de hora_inicio/hora_fin — esa regla depende de
-- columnas ya validadas en la fila y Postgres no permite CHECKs entre
-- columnas con subqueries; queda en la capa de aplicación.
ALTER TABLE schedules
  ADD CONSTRAINT schedules_break_consistency CHECK (
    (break_start IS NULL AND break_end IS NULL)
    OR (break_start IS NOT NULL AND break_end IS NOT NULL AND break_start < break_end)
  );
