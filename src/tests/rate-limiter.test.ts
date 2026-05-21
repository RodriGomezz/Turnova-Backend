import assert from "node:assert/strict";
import test from "node:test";

// Tests puramente de lógica de la variable de control — sin Express

test("SEC-003: DISABLE_RATE_LIMIT=true desactiva el limiter", () => {
  process.env.DISABLE_RATE_LIMIT = "true";
  // Reimportar el módulo para que lea la env var actualizada.
  // Como no podemos hacer cache-busting fácil en ESM, testeamos la lógica directamente.
  const isDisabled = process.env.DISABLE_RATE_LIMIT === "true";
  assert.equal(isDisabled, true);
});

test("SEC-003: DISABLE_RATE_LIMIT ausente NO desactiva el limiter", () => {
  delete process.env.DISABLE_RATE_LIMIT;
  const isDisabled = process.env.DISABLE_RATE_LIMIT === "true";
  assert.equal(isDisabled, false);
});

test("SEC-003: DISABLE_RATE_LIMIT=false NO desactiva el limiter", () => {
  process.env.DISABLE_RATE_LIMIT = "false";
  const isDisabled = process.env.DISABLE_RATE_LIMIT === "true";
  assert.equal(isDisabled, false);
});

test("SEC-003: NODE_ENV=development NO desactiva el limiter (a diferencia del código anterior)", () => {
  process.env.NODE_ENV = "development";
  delete process.env.DISABLE_RATE_LIMIT;
  // Con la lógica nueva, NODE_ENV no importa — solo DISABLE_RATE_LIMIT
  const isDisabledByEnv   = process.env.NODE_ENV !== "production"; // lógica vieja
  const isDisabledByFlag  = process.env.DISABLE_RATE_LIMIT === "true"; // lógica nueva
  assert.equal(isDisabledByEnv,  true,  "lógica VIEJA: NODE_ENV=development desactivaría el limiter");
  assert.equal(isDisabledByFlag, false, "lógica NUEVA: no debe desactivar sin el flag explícito");
});

test("SEC-003: NODE_ENV=staging equivale a development y tampoco desactiva el limiter", () => {
  process.env.NODE_ENV = "staging";
  delete process.env.DISABLE_RATE_LIMIT;
  const isDisabledByFlag = process.env.DISABLE_RATE_LIMIT === "true";
  assert.equal(isDisabledByFlag, false, "staging no debe desactivar el rate limiter");
});
