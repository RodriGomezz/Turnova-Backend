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
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
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
