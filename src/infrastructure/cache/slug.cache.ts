/**
 * SlugCache — Hash map en memoria para disponibilidad de slugs en tiempo real.
 *
 * ── Contexto ────────────────────────────────────────────────────────────────
 * Cuando un usuario escribe su slug en el registro, el frontend necesita saber
 * si ya está tomado. Sin este cache, cada keystroke haría un SELECT a la BD.
 *
 * Con el cache el flujo es:
 *   1. Al arrancar el servidor (o lazy al primer check): cargar todos los slugs
 *      existentes en un Set<string>.
 *   2. El endpoint GET /api/businesses/slug-check?slug=X consulta el Set.
 *      Costo: O(1), cero queries a la BD.
 *   3. Al crear un negocio: agregar el slug al Set.
 *   4. Al eliminar/cambiar un negocio: remover el slug del Set.
 *
 * ── ¿No es un problema de stale data? ───────────────────────────────────────
 * El slug es inmutable después de creado (no se puede cambiar sin URL breaking).
 * El único riesgo es una TOCTOU race donde dos usuarios registran el slug en el
 * mismo instante. Por eso:
 *   - El cache dice "disponible" → el usuario puede intentar registrarse.
 *   - La BD tiene un UNIQUE constraint como última línea de defensa.
 *   - Si la BD rechaza, devolvemos ConflictError (409) — el frontend lo maneja.
 *
 * ── Escalabilidad ───────────────────────────────────────────────────────────
 * Con 100.000 slugs de 20 chars: ~2 MB en memoria. Perfectamente razonable.
 * Para arquitecturas multi-instancia (múltiples pods), migrar a Redis Set.
 * Mientras sea una sola instancia, este cache en memoria es suficiente.
 */

import { supabase } from "../database/supabase.client";
import { logger } from "../logger";

// Set con todos los slugs existentes
const slugSet = new Set<string>();
let   initialized = false;
let   initPromise: Promise<void> | null = null;

// ── Inicialización lazy ───────────────────────────────────────────────────────

async function loadAllSlugs(): Promise<void> {
  logger.info("SlugCache: cargando slugs desde la BD...");

  // Supabase limita a 1000 filas por query — paginar si es necesario
  let page  = 0;
  const PAGE = 1_000;
  let   total = 0;

  while (true) {
    const { data, error } = await supabase
      .from("businesses")
      .select("slug")
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) {
      logger.error("SlugCache: error cargando slugs", { error: error.message });
      throw error;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.slug) slugSet.add(row.slug as string);
    }

    total += data.length;
    if (data.length < PAGE) break;
    page++;
  }

  initialized = true;
  logger.info(`SlugCache: ${total} slugs cargados`);
}

function ensureInitialized(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (!initPromise) initPromise = loadAllSlugs();
  return initPromise;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve true si el slug está disponible (no existe en el Set).
 * Inicializa el cache la primera vez que se llama (lazy init).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  await ensureInitialized();
  return !slugSet.has(slug.toLowerCase().trim());
}

/**
 * Registrar un slug recién creado para que quede bloqueado inmediatamente.
 * Llamar justo después de crear el negocio en la BD.
 */
export function registerSlug(slug: string): void {
  slugSet.add(slug.toLowerCase().trim());
}

/**
 * Liberar un slug (si se elimina un negocio).
 * ADVERTENCIA: En la práctica los slugs raramente se liberan — son URLs públicas.
 */
export function releaseSlug(slug: string): void {
  slugSet.delete(slug.toLowerCase().trim());
}

/** Forzar recarga completa desde la BD (útil para rollouts y tests) */
export async function reloadSlugCache(): Promise<void> {
  slugSet.clear();
  initialized = false;
  initPromise  = null;
  await loadAllSlugs();
}

/** Stats para monitoreo */
export function getSlugCacheStats(): { size: number; initialized: boolean } {
  return { size: slugSet.size, initialized };
}
