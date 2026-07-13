-- Migración 014: agrega recordatorio_horas_antes a businesses.
--
-- El recordatorio de turno del día siguiente venía con anticipación
-- variable (entre ~13hs y ~38hs según la hora del turno, ver comentario en
-- BookingRepository.findPendingReminders) porque se calculaba por fecha
-- calendario ("mañana") en vez de por hora exacta.
--
-- Este campo permite que cada negocio configure cuántas horas antes del
-- turno quiere que salga el recordatorio (default 24, igual que la mayoría
-- de la competencia — Fresha lo deja configurable, Booksy lo tiene fijo en
-- 24hs). El cálculo preciso vive en el job (booking-reminder.job.ts), que
-- ahora compara fecha+hora_inicio del turno menos recordatorio_horas_antes
-- contra la hora actual, en vez de comparar por fecha calendario.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS recordatorio_horas_antes SMALLINT NOT NULL DEFAULT 24
  CHECK (recordatorio_horas_antes BETWEEN 1 AND 72);

-- Negocios ya existentes (creados antes de esta migración) también quedan
-- en 24 por el DEFAULT de la columna — no hace falta backfill explícito.
