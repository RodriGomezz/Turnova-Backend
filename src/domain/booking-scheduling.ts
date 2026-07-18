/**
 * Cálculo de "bloques de atención activa" de una reserva — la pieza central
 * del soporte de tiempo de procesamiento (ver migraciones 015/016).
 *
 * Un booking_item puede tener hasta 2 fases activas (aplicación y acabado)
 * separadas por una fase de procesamiento sin atención. Este helper es puro
 * y espejo exacto de la lógica en SQL de create_booking_with_items — se usa
 * en el backend para pre-calcular candidatos de disponibilidad sin pegarle
 * a la base, y en tests para verificar la lógica sin levantar Postgres.
 *
 * IMPORTANTE: si esta lógica cambia, la función SQL en
 * 016_chair_aware_exclusion_and_active_blocks.sql tiene que cambiar igual —
 * no son "el mismo código" en dos lenguajes, son dos implementaciones que
 * deben mantenerse equivalentes a mano. Ver tests/booking-scheduling.test.ts.
 */

export interface BookingItemInput {
  orden: number;
  duracion_minutos: number;
  /** Si se omite, se asume que todo el item es activo (sin fases). */
  tiempo_activo_inicial_minutos?: number;
  tiempo_procesamiento_minutos?: number;
}

export interface ActiveBlock {
  /** Minutos desde el inicio de la reserva (hora_inicio) en que arranca el bloque. */
  startsAtMinuteOffset: number;
  /** Minutos desde el inicio de la reserva en que termina el bloque. */
  endsAtMinuteOffset: number;
}

/**
 * Dado el listado de items de una reserva (en cualquier orden), devuelve
 * los bloques donde el barbero necesita prestar atención activa, como
 * offsets en minutos desde el inicio de la reserva. Los huecos entre
 * bloques son tiempo de procesamiento — libre para atender a otro cliente.
 */
export function computeActiveBlocks(items: BookingItemInput[]): ActiveBlock[] {
  const ordenados = [...items].sort((a, b) => a.orden - b.orden);
  const blocks: ActiveBlock[] = [];
  let cursor = 0;

  for (const item of ordenados) {
    const duracion = item.duracion_minutos;
    if (duracion <= 0) continue;

    const activoInicial = item.tiempo_activo_inicial_minutos ?? duracion;
    const procesamiento = item.tiempo_procesamiento_minutos ?? 0;

    const activoInicialEnd = cursor + activoInicial;
    blocks.push({ startsAtMinuteOffset: cursor, endsAtMinuteOffset: activoInicialEnd });

    if (procesamiento > 0 && activoInicial + procesamiento < duracion) {
      const acabadoStart = activoInicialEnd + procesamiento;
      const itemEnd = cursor + duracion;
      blocks.push({ startsAtMinuteOffset: acabadoStart, endsAtMinuteOffset: itemEnd });
    }

    cursor += duracion;
  }

  return blocks;
}

/**
 * true si dos rangos [start, end) de minutos se solapan.
 */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Chequea si un candidato (nueva reserva hipotética que empieza en
 * `candidateStartMinuteOffset` respecto al mismo día, con estos items)
 * choca en atención activa con los bloques activos ya ocupados de OTRAS
 * reservas del mismo barbero ese día (también expresados como offsets en
 * minutos desde medianoche). Es la versión en memoria de lo que
 * booking_active_blocks_no_overlap garantiza en la base — se usa para no
 * ofrecer un slot en el buscador de disponibilidad que la base va a
 * rechazar de todos modos.
 */
export function activeBlocksCollide(
  candidateStartMinuteFromMidnight: number,
  candidateItems: BookingItemInput[],
  existingActiveBlocksMinuteFromMidnight: Array<{ start: number; end: number }>,
): boolean {
  const candidateBlocks = computeActiveBlocks(candidateItems).map((b) => ({
    start: candidateStartMinuteFromMidnight + b.startsAtMinuteOffset,
    end: candidateStartMinuteFromMidnight + b.endsAtMinuteOffset,
  }));

  return candidateBlocks.some((cb) =>
    existingActiveBlocksMinuteFromMidnight.some((eb) =>
      overlaps(cb.start, cb.end, eb.start, eb.end),
    ),
  );
}

export interface MinuteRange {
  start: number;
  end: number;
}

/**
 * true si hay al menos una silla física libre para un slot candidato
 * [slotStart, slotEnd), dado el listado de reservas del día expresadas
 * como su rango COMPLETO (hora_inicio–hora_fin en minutos, no solo tiempo
 * activo) — la silla es un recurso físico, ocupada mientras el cliente
 * siga sentado ahí, aunque el barbero esté libre para atender a otro en
 * paralelo. Espejo en memoria de bookings_no_overlap_por_silla.
 */
export function haySillaLibre(
  slotStart: number,
  slotEnd: number,
  bookingRanges: MinuteRange[],
  capacidadSillas: number,
): boolean {
  const sillasOcupadas = bookingRanges.filter((b) =>
    overlaps(slotStart, slotEnd, b.start, b.end),
  ).length;
  return sillasOcupadas < capacidadSillas;
}

/**
 * Única fuente de verdad para "¿este slot está disponible?", usada por
 * TODO buscador de disponibilidad (día único o mes completo). Combina las
 * dos garantías que ya viven en la base (mig. 016): silla física libre Y
 * barbero sin choque de atención activa.
 *
 * Justificación de por qué esto vive acá y no repetido en cada use case:
 * GetAllSlotsForDaysUseCase tenía su propia copia de esta lógica que
 * nunca se actualizó cuando se agregó soporte de capacidad_sillas/tiempo
 * de procesamiento — servía slots como "disponibles" que en realidad
 * tenían la silla ocupada o el barbero sin bloque activo libre. Que las
 * dos rutas (día único y mes completo) llamen a esta misma función hace
 * que esa clase de bug sea estructuralmente imposible de repetir: no hay
 * una segunda copia que se pueda quedar desactualizada.
 */
export function isSlotDisponible(
  slotStart: number,
  slotEnd: number,
  bookingRanges: MinuteRange[],
  capacidadSillas: number,
  candidateItems: BookingItemInput[],
  existingActiveBlocks: MinuteRange[],
): boolean {
  if (capacidadSillas <= 1) {
    // Comportamiento original, sin cambios: una sola silla, el rango
    // completo de cualquier reserva existente la ocupa entera.
    return !bookingRanges.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
  }

  const sillaLibre = haySillaLibre(slotStart, slotEnd, bookingRanges, capacidadSillas);
  if (!sillaLibre) return false;

  return !activeBlocksCollide(slotStart, candidateItems, existingActiveBlocks);
}

/**
 * Genera los minutos-desde-medianoche donde puede EMPEZAR un turno
 * candidato, dentro de [scheduleStart, scheduleEnd).
 *
 * Caso capacidadSillas <= 1: grilla fija de siempre, cada `duracion +
 * buffer` minutos desde la apertura — sin cambios de comportamiento.
 *
 * Caso capacidadSillas > 1: la grilla fija por sí sola tiene un punto
 * ciego real. Si un servicio de 60 min (20 activos + 40 de espera) ocupa
 * 09:00–10:00, y otro cliente pide el MISMO servicio (mismos 60 min de
 * paso), la grilla fija solo prueba 09:00 (choca) y 10:00 (ya terminó el
 * primero, no aprovecha la silla libre en paralelo) — nunca prueba 09:20,
 * que es exactamente cuando el barbero queda libre para atender en la
 * otra silla. Un servicio de duración distinta puede "pisar" ese hueco
 * por la casualidad de su propio paso, pero no es algo que debería
 * depender de la suerte. Por eso acá se agrega un candidato extra justo
 * al terminar cada bloque activo existente ese día — el momento más útil
 * que la grilla fija se salta sistemáticamente cuando coincide la
 * duración del servicio.
 */
export function generateCandidateStartMinutes(
  scheduleStart: number,
  scheduleEnd: number,
  duracion: number,
  buffer: number,
  capacidadSillas: number,
  existingActiveBlocks: MinuteRange[],
): number[] {
  const candidates = new Set<number>();

  for (let t = scheduleStart; t + duracion <= scheduleEnd; t += duracion + buffer) {
    candidates.add(t);
  }

  if (capacidadSillas > 1) {
    for (const block of existingActiveBlocks) {
      if (block.end >= scheduleStart && block.end + duracion <= scheduleEnd) {
        candidates.add(block.end);
      }
    }
  }

  return [...candidates].sort((a, b) => a - b);
}
