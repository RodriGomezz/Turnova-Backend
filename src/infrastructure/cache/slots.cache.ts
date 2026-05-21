/**
 * Cache en memoria para slots precargados por mes.
 *
 * Clave: `${businessId}:${barberId}:${serviceId}:${year}-${month}`
 * TTL:    2 minutos — corto para reflejar reservas recientes sin stale data.
 *
 * ── Invalidación ─────────────────────────────────────────────────────────────
 * Cuando se crea o cancela una reserva (CreateBookingUseCase, cancelByToken),
 * llamar a invalidateSlotsCache(businessId) para que el próximo request
 * regenere los slots con datos frescos.
 *
 * ── Memoria ──────────────────────────────────────────────────────────────────
 * Máximo 200 entradas (200 combinaciones de negocio+barbero+mes activos).
 * Una entrada pesa ~21 KB → techo de ~4 MB. Razonable para un proceso Node.
 */

import { GetAllSlotsForDaysResult } from "../../application/bookings/GetAllSlotsForDaysUseCase";

const SLOTS_CACHE_TTL_MS  = 2 * 60 * 1_000; // 2 minutos
const SLOTS_CACHE_MAX_SIZE = 200;

interface SlotsCacheEntry {
  data:      GetAllSlotsForDaysResult;
  timestamp: number;
  businessId: string;
}

const slotsCache = new Map<string, SlotsCacheEntry>();

function makeKey(
  businessId: string,
  barberId:   string,
  serviceId:  string,
  year:       number,
  month:      number,
): string {
  return `${businessId}:${barberId}:${serviceId}:${year}-${month}`;
}

export function getSlotsFromCache(
  businessId: string,
  barberId:   string,
  serviceId:  string,
  year:       number,
  month:      number,
): GetAllSlotsForDaysResult | null {
  const key   = makeKey(businessId, barberId, serviceId, year, month);
  const entry = slotsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SLOTS_CACHE_TTL_MS) {
    slotsCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setSlotsCache(
  businessId: string,
  barberId:   string,
  serviceId:  string,
  year:       number,
  month:      number,
  data:       GetAllSlotsForDaysResult,
): void {
  if (slotsCache.size >= SLOTS_CACHE_MAX_SIZE) {
    // Eviction FIFO: eliminar la entrada más antigua
    const firstKey = slotsCache.keys().next().value;
    if (firstKey !== undefined) slotsCache.delete(firstKey);
  }
  const key = makeKey(businessId, barberId, serviceId, year, month);
  slotsCache.set(key, { data, timestamp: Date.now(), businessId });
}

/** Invalida todas las entradas de un negocio (llamar después de crear/cancelar reserva) */
export function invalidateSlotsCache(businessId: string): void {
  for (const [key, entry] of slotsCache.entries()) {
    if (entry.businessId === businessId) slotsCache.delete(key);
  }
}

/** Para tests y monitoreo */
export function getSlotsCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: slotsCache.size, maxSize: SLOTS_CACHE_MAX_SIZE, ttlMs: SLOTS_CACHE_TTL_MS };
}
