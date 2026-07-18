-- Migración 019: hardening de seguridad — RLS y grants.
--
-- Origen: auditoría de seguridad sobre RLS/policies/grants (julio 2026).
-- Los tres cambios de abajo ya fueron aplicados a mano en el SQL Editor de
-- producción durante la auditoría — esta migración los deja versionados
-- para que un entorno nuevo (staging, disaster recovery, otro desarrollador
-- levantando la base desde cero) quede con el mismo nivel de protección sin
-- depender de que alguien repita los pasos manuales.
--
-- Es seguro volver a correrla sobre la base de producción: DROP/CREATE
-- POLICY y REVOKE son idempotentes (no fallan si el estado ya es el
-- deseado).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. barber_services: la policy de escritura tenía TO public en vez de
--    TO service_role (probablemente un CREATE POLICY sin la cláusula TO,
--    que en Postgres cae por default a "public" = cualquier rol conectado,
--    incluido anon).
--
--    Vector de ataque real: con solo la anon key (pública por diseño en
--    el frontend), cualquiera podía insertar, modificar o borrar filas de
--    qué servicio ofrece qué barbero, de cualquier negocio, sin login —
--    porque la policy tenía USING(true) WITH CHECK(true) sin restricción
--    de rol.
--
--    La policy de lectura pública (barber_services_public_read) se deja
--    intacta a propósito: es la que permite que la página pública de
--    reservas muestre qué barbero hace qué servicio sin requerir sesión.
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "barber_services_service_role_write" ON barber_services;

CREATE POLICY "barber_services_service_role_write"
  ON barber_services
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. business_subscription (vista, migración 001): ya tiene
--    security_invoker=on, así que respeta el RLS de subscriptions
--    (service_role-only) y devuelve 0 filas para anon/authenticated —
--    no era explotable. Igual se le sacan los grants a esos roles porque
--    son ruido: si algún día la vista se recrea con
--    CREATE OR REPLACE VIEW sin repetir security_invoker=on (vuelve al
--    comportamiento por dueño de la vista), el grant amplio pasaría de
--    inocuo a explotable sin que cambie nada visible en la app. Sacarlo
--    ahora es defensa en profundidad, no una corrección de un bug activo.
-- ─────────────────────────────────────────────────────────────────────────

REVOKE ALL ON business_subscription FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. booking_items / booking_tickets / booking_active_blocks: tienen
--    rowsecurity = true y CERO policies, lo cual es deny-all real para
--    anon/authenticated (correcto y confirmado funcionando — el flujo de
--    creación de reservas pasa por el backend con service_role, que
--    bypasea RLS). Pero seguían teniendo grants amplios (SELECT/INSERT/
--    UPDATE/DELETE) a nivel de tabla para esos dos roles, heredados del
--    comportamiento default de Supabase al crear tablas.
--
--    Hoy esos grants son inocuos porque no hay ninguna policy que los
--    habilite. El riesgo es a futuro: si alguien agrega una policy mal
--    escrita más adelante (el mismo tipo de error que en el punto 1 de
--    esta migración), los grants ya presentes la vuelven explotable al
--    instante. Sacarlos ahora hace que ese error futuro falle en la capa
--    de grants, antes de que RLS entre en juego — una red de seguridad
--    adicional, no una corrección de algo roto hoy.
-- ─────────────────────────────────────────────────────────────────────────

REVOKE ALL ON booking_items, booking_tickets, booking_active_blocks
  FROM anon, authenticated;
