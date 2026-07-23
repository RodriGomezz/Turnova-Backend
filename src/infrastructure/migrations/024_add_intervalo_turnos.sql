-- Migración 024: intervalo de turnos configurable, desacoplado de la
-- duración del servicio.
--
-- CONTEXTO: generateCandidateStartMinutes (domain/booking-scheduling.ts)
-- generaba la grilla de horarios ofrecidos avanzando de a `duracion_del_
-- servicio + buffer` minutos desde la apertura. Esto significa que un
-- servicio de 2 horas solo podía empezar cada 2 horas (9:00, 11:00, 13:00…)
-- aunque el profesional estuviera libre a las 9:30 — cualquier hueco más
-- chico que la duración del servicio quedaba inutilizable. Fresha y
-- Calendly (referencias del rubro) resuelven esto con un intervalo de
-- inicio configurable por el negocio, totalmente independiente de cuánto
-- dure cada servicio: la grilla de horarios ofrecidos avanza cada
-- `intervalo_turnos_minutos`, y cada candidato se valida por separado
-- contra la duración real del servicio pedido.
--
-- Default 60: cualquier negocio existente arranca con exactamente el
-- mismo comportamiento que tenía para sus servicios de 60 min (el caso
-- más común), y mejora de entrada la disponibilidad ofrecida para
-- servicios de otra duración sin que el dueño tenga que configurar nada.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS intervalo_turnos_minutos INTEGER NOT NULL DEFAULT 60
    CHECK (intervalo_turnos_minutos > 0 AND intervalo_turnos_minutos <= 240);
