/**
 * Helpers puros para calcular precio y duración total de una reserva a
 * partir de sus booking_items — único lugar donde vive esta lógica.
 *
 * Antes de existir booking_items, StatsController, GetDaySummaryUseCase
 * y el agrupamiento "servicio más solicitado" cada uno hacía su propio
 * `b.services?.precio ?? 0` contra la columna legacy bookings.service_id.
 * Eso triplicaba la lógica Y leía el precio ACTUAL del catálogo en vez
 * del snapshot congelado al momento de la reserva (bug de retroactividad
 * documentado en la sesión de diseño). Centralizar acá resuelve ambos
 * problemas a la vez.
 */

export interface PricedItem {
  precio: number;
}

export interface TimedItem {
  duracion_minutos: number;
}

/** Suma el precio de los booking_items de una reserva. 0 si no tiene items. */
export function sumPrecioItems(items: PricedItem[] | null | undefined): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.precio, 0);
}

/** Suma la duración de los booking_items de una reserva. 0 si no tiene items. */
export function sumDuracionItems(items: TimedItem[] | null | undefined): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.duracion_minutos, 0);
}
