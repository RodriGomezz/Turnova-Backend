import assert from "node:assert/strict";
import test from "node:test";
import { computeActiveBlocks, activeBlocksCollide } from "../domain/booking-scheduling";

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
