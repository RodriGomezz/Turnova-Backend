-- Migración 008: soporte de múltiples servicios por reserva
--
-- Esta migración es ADITIVA: no modifica ni elimina ninguna columna existente.
-- bookings.service_id se mantiene intacto hasta la migración de limpieza
-- (ver Fase 6 del plan), que solo debe correr cuando se confirme que
-- ningún consumidor (frontend viejo, jobs, reportes) sigue leyéndolo.

-- 1. Marca de servicio "genérico" — usado para ítems sin catálogo
--    (productos, adicionales ad-hoc) en lugar de un service_id nullable.
--    Cada negocio tiene exactamente un servicio con es_generico = true,
--    creado automáticamente al dar de alta el negocio (ver CreateBusinessUseCase)
--    o por el backfill de la migración 009 para negocios ya existentes.
ALTER TABLE services ADD COLUMN IF NOT EXISTS es_generico BOOLEAN NOT NULL DEFAULT false;

-- Garantiza que cada negocio tenga a lo sumo un servicio genérico.
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_unico_generico_por_negocio
  ON services (business_id)
  WHERE es_generico = true;

-- 2. booking_items — líneas de detalle de una reserva.
--    Reemplaza bookings.service_id (cardinalidad 1) por una relación 1..N.
--    nombre y precio son snapshots tomados al momento de crear el ítem,
--    NUNCA se leen en vivo desde services — así los reportes históricos
--    no mutan si el negocio cambia precios después.
CREATE TABLE IF NOT EXISTS booking_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES services(id),
  nombre           TEXT NOT NULL,
  precio           NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  duracion_minutos INTEGER NOT NULL DEFAULT 0 CHECK (duracion_minutos >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id ON booking_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_service_id ON booking_items(service_id);

-- 3. booking_tickets — estado de cobro de una reserva, separado de la agenda.
--    estado = 'abierto'  -> los items son mutables (agregar, quitar, editar precio)
--    estado = 'cobrado'  -> inmutable; para corregir, se anula y se recrea la venta
--    No hay límite de tiempo para mantenerse en 'abierto': el barbero cierra
--    la cuenta cuando termina de cobrar, no un timer del sistema.
CREATE TABLE IF NOT EXISTS booking_tickets (
  booking_id  UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  estado      TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cobrado')),
  cobrado_at  TIMESTAMPTZ,
  metodo_pago TEXT
);
