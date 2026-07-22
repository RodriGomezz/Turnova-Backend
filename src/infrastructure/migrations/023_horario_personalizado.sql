-- Migración 023: horario_texto pasa de "siempre texto libre" a
-- "generado automático por defecto, con override opcional".
--
-- CONTEXTO: horario_texto vivía desconectado de `schedules` (la fuente de
-- verdad real de disponibilidad) — el dueño lo escribía a mano en
-- Configuración → Página pública y nada le avisaba si quedaba
-- desactualizado respecto al horario real. Ver análisis de UX que motivó
-- este cambio.
--
-- A partir de esta migración, la página pública genera el horario a
-- mostrar automáticamente desde `schedules` (días + horas reales), salvo
-- que el negocio marque horario_personalizado = true, en cuyo caso se usa
-- horario_texto tal cual (para el caso "con cita previa" / sin horario
-- fijo publicable).
--
-- Default false: todos los negocios existentes pasan a usar el horario
-- automático de entrada. Si su horario_texto actual coincidía con su
-- horario real (el caso común), no cambia nada visible. Si no coincidía
-- (el bug que estamos resolviendo), esto lo corrige solo, sin que el
-- dueño tenga que hacer nada.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS horario_personalizado BOOLEAN NOT NULL DEFAULT false;
