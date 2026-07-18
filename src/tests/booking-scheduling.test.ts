import assert from "node:assert/strict";
import test from "node:test";
import {
  computeActiveBlocks,
  activeBlocksCollide,
  haySillaLibre,
  isSlotDisponible,
  generateCandidateStartMinutes,
} from "../domain/booking-scheduling";

test("computeActiveBlocks: servicio sin fases = un solo bloque activo de toda la duración", () => {
  const blocks = computeActiveBlocks([{ orden: 0, duracion_minutos: 45 }]);
  assert.deepEqual(blocks, [{ startsAtMinuteOffset: 0, endsAtMinuteOffset: 45 }]);
});

test("computeActiveBlocks: color con procesamiento genera 2 bloques activos con hueco libre", () => {
  // 20 min aplicación + 50 min procesamiento + 20 min acabado = 90 min total
  const blocks = computeActiveBlocks([
    {
      orden: 0,
      duracion_minutos: 90,
      tiempo_activo_inicial_minutos: 20,
      tiempo_procesamiento_minutos: 50,
    },
  ]);
  assert.deepEqual(blocks, [
    { startsAtMinuteOffset: 0, endsAtMinuteOffset: 20 },
    { startsAtMinuteOffset: 70, endsAtMinuteOffset: 90 },
  ]);
});

test("computeActiveBlocks: procesamiento sin fase de acabado no genera segundo bloque", () => {
  // 20 min aplicación + 70 min procesamiento = 90 min total, sin acabado
  const blocks = computeActiveBlocks([
    {
      orden: 0,
      duracion_minutos: 90,
      tiempo_activo_inicial_minutos: 20,
      tiempo_procesamiento_minutos: 70,
    },
  ]);
  assert.deepEqual(blocks, [{ startsAtMinuteOffset: 0, endsAtMinuteOffset: 20 }]);
});

test("computeActiveBlocks: combo secuencial de 2 servicios sin fases, uno después del otro", () => {
  const blocks = computeActiveBlocks([
    { orden: 0, duracion_minutos: 30 },
    { orden: 1, duracion_minutos: 20 },
  ]);
  assert.deepEqual(blocks, [
    { startsAtMinuteOffset: 0, endsAtMinuteOffset: 30 },
    { startsAtMinuteOffset: 30, endsAtMinuteOffset: 50 },
  ]);
});

test("computeActiveBlocks: respeta `orden` sin importar el orden del array de entrada", () => {
  const blocks = computeActiveBlocks([
    { orden: 1, duracion_minutos: 20 },
    { orden: 0, duracion_minutos: 30 },
  ]);
  assert.deepEqual(blocks, [
    { startsAtMinuteOffset: 0, endsAtMinuteOffset: 30 },
    { startsAtMinuteOffset: 30, endsAtMinuteOffset: 50 },
  ]);
});

test("activeBlocksCollide: el caso real del cliente — corte encaja en el hueco de procesamiento del color", () => {
  // Color 10:00–11:30 (600 min desde medianoche) con 20/50/20.
  // Bloques activos: 600-620 (aplicación) y 670-690 (acabado). Libre 620-670.
  const colorStart = 10 * 60;
  const existingActiveBlocks = [
    { start: colorStart, end: colorStart + 20 },
    { start: colorStart + 70, end: colorStart + 90 },
  ];

  // Corte de 30 min a las 10:20 (620) — cabe justo en el hueco libre (620-670).
  const corteStart = 10 * 60 + 20;
  const colisiona = activeBlocksCollide(
    corteStart,
    [{ orden: 0, duracion_minutos: 30 }],
    existingActiveBlocks,
  );

  assert.equal(colisiona, false);
});

test("activeBlocksCollide: un corte que empieza antes de que termine el acabado del color sí choca", () => {
  const colorStart = 10 * 60;
  const existingActiveBlocks = [
    { start: colorStart, end: colorStart + 20 },
    { start: colorStart + 70, end: colorStart + 90 }, // acabado: 11:10–11:30
  ];

  // Corte de 30 min a las 10:50 (11:00–11:20) — pisa el acabado (11:10–11:30).
  const corteStart = 10 * 60 + 50;
  const colisiona = activeBlocksCollide(
    corteStart,
    [{ orden: 0, duracion_minutos: 30 }],
    existingActiveBlocks,
  );

  assert.equal(colisiona, true);
});

test("haySillaLibre: con capacidad_sillas=1, una reserva existente ocupa la única silla", () => {
  const libre = haySillaLibre(9 * 60, 10 * 60, [{ start: 9 * 60, end: 10 * 60 }], 1);
  assert.equal(libre, false);
});

test("haySillaLibre: con capacidad_sillas=2, una reserva existente deja la segunda silla libre", () => {
  const libre = haySillaLibre(9 * 60, 10 * 60, [{ start: 9 * 60, end: 10 * 60 }], 2);
  assert.equal(libre, true);
});

test("haySillaLibre: con capacidad_sillas=2, dos reservas existentes ocupan ambas sillas", () => {
  const libre = haySillaLibre(
    9 * 60,
    10 * 60,
    [{ start: 9 * 60, end: 10 * 60 }, { start: 9 * 60, end: 10 * 60 }],
    2,
  );
  assert.equal(libre, false);
});

// Caso reportado en producción: barbero con capacidad_sillas=2, servicio de
// 60 min total (20 activos + 40 de procesamiento). Un segundo cliente
// debería poder agendar con el mismo barbero, en la segunda silla, DURANTE
// los 40 min de procesamiento del primero — GetAllSlotsForDaysUseCase lo
// bloqueaba como si capacidadSillas fuera 1, porque tenía su propia
// implementación desactualizada que no llamaba a esta función.
test("isSlotDisponible: 2 sillas + servicio con procesamiento — el 2do cliente SÍ puede entrar en el hueco de espera del 1ro", () => {
  const colorStart = 9 * 60; // 09:00
  const primeraReserva = { start: colorStart, end: colorStart + 60 }; // silla 1, 09:00–10:00

  // El barbero solo está activo 09:00–09:20 (aplicación) con este servicio
  // sin fase de acabado (20 activos + 40 procesamiento = 60, sin resto).
  const activeBlocksDelDia = [{ start: colorStart, end: colorStart + 20 }];

  const candidatoItems = [
    { orden: 0, duracion_minutos: 60, tiempo_activo_inicial_minutos: 20, tiempo_procesamiento_minutos: 40 },
  ];

  // Un segundo cliente con el mismo servicio, empezando a las 09:20 (cuando
  // el barbero ya liberó su atención activa) — debe estar disponible.
  const disponible = isSlotDisponible(
    colorStart + 20,
    colorStart + 20 + 60,
    [primeraReserva],
    2, // capacidad_sillas
    candidatoItems,
    activeBlocksDelDia,
  );

  assert.equal(disponible, true);
});

test("isSlotDisponible: con capacidad_sillas=1 (default), el mismo caso de arriba SÍ debe bloquear la hora completa", () => {
  const colorStart = 9 * 60;
  const primeraReserva = { start: colorStart, end: colorStart + 60 };
  const activeBlocksDelDia = [{ start: colorStart, end: colorStart + 20 }];
  const candidatoItems = [
    { orden: 0, duracion_minutos: 60, tiempo_activo_inicial_minutos: 20, tiempo_procesamiento_minutos: 40 },
  ];

  const disponible = isSlotDisponible(
    colorStart + 20,
    colorStart + 20 + 60,
    [primeraReserva],
    1, // capacidad_sillas = 1: sin segunda silla, sigue bloqueado
    candidatoItems,
    activeBlocksDelDia,
  );

  assert.equal(disponible, false);
});

test("isSlotDisponible: 2 sillas libres pero el barbero sigue activo — no disponible aunque haya silla", () => {
  const colorStart = 9 * 60;
  const primeraReserva = { start: colorStart, end: colorStart + 60 };
  const activeBlocksDelDia = [{ start: colorStart, end: colorStart + 20 }];
  const candidatoItems = [{ orden: 0, duracion_minutos: 30 }]; // sin fases, 100% activo

  // Candidato a las 09:10 — pisa el bloque activo del primero (09:00–09:20),
  // aunque haya una segunda silla libre.
  const disponible = isSlotDisponible(
    colorStart + 10,
    colorStart + 10 + 30,
    [primeraReserva],
    2,
    candidatoItems,
    activeBlocksDelDia,
  );

  assert.equal(disponible, false);
});

// Caso reportado en producción (segunda vuelta): con capacidad_sillas=2 y
// turno largo (09:00–18:00), pedir el MISMO servicio (60 min, mismo paso
// que la reserva ya agendada) nunca ofrecía un horario dentro del hueco de
// procesamiento — la grilla fija de siempre (cada 60 min desde la apertura)
// salta exactamente por encima de 09:20, que es cuando el barbero se
// libera. Un servicio de otra duración lo pisaba por casualidad de su
// propio paso; el mismo servicio, nunca.
test("generateCandidateStartMinutes: agrega el momento exacto en que termina un bloque activo existente", () => {
  const schedStart = 9 * 60;
  const schedEnd = 18 * 60;
  const activeBlocksDelDia = [{ start: 9 * 60, end: 9 * 60 + 20 }]; // 09:00–09:20

  const candidatos = generateCandidateStartMinutes(schedStart, schedEnd, 60, 0, 2, activeBlocksDelDia);

  assert.ok(candidatos.includes(9 * 60 + 20), "debería incluir 09:20 como candidato");
  assert.ok(candidatos.includes(9 * 60), "no debe perder la grilla fija original (09:00)");
});

test("generateCandidateStartMinutes: con capacidad_sillas=1 no agrega candidatos extra (comportamiento sin cambios)", () => {
  const schedStart = 9 * 60;
  const schedEnd = 18 * 60;
  const activeBlocksDelDia = [{ start: 9 * 60, end: 9 * 60 + 20 }];

  const candidatos = generateCandidateStartMinutes(schedStart, schedEnd, 60, 0, 1, activeBlocksDelDia);

  // Con 1 silla, el bloque activo es irrelevante para la grilla — solo la grilla fija.
  assert.deepEqual(candidatos, [540, 600, 660, 720, 780, 840, 900, 960, 1020]);
});

test("isSlotDisponible + generateCandidateStartMinutes juntos: el MISMO servicio de 60 min sí encuentra 09:20 disponible", () => {
  const schedStart = 9 * 60;
  const schedEnd = 18 * 60;
  const primeraReserva = { start: 9 * 60, end: 10 * 60 };
  const activeBlocksDelDia = [{ start: 9 * 60, end: 9 * 60 + 20 }];
  const items = [
    { orden: 0, duracion_minutos: 60, tiempo_activo_inicial_minutos: 20, tiempo_procesamiento_minutos: 40 },
  ];

  const candidatos = generateCandidateStartMinutes(schedStart, schedEnd, 60, 0, 2, activeBlocksDelDia);
  const resultados = candidatos.map((start) => ({
    start,
    disponible: isSlotDisponible(start, start + 60, [primeraReserva], 2, items, activeBlocksDelDia),
  }));

  const slot0920 = resultados.find((r) => r.start === 9 * 60 + 20);
  const slot0900 = resultados.find((r) => r.start === 9 * 60);

  assert.equal(slot0920?.disponible, true, "09:20 debería quedar disponible para el mismo servicio");
  assert.equal(slot0900?.disponible, false, "09:00 sigue chocando con la primera reserva");
});
