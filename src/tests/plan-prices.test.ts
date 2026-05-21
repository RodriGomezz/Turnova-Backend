import assert from "node:assert/strict";
import test from "node:test";
import {
  TRIAL_DAYS,
  PLAN_PRICES_MONTHLY,
  PLAN_PRICES_ANNUAL,
  PLAN_NAMES_MONTHLY,
  PLAN_NAMES_ANNUAL,
  PLAN_PRICES,
  getPlanPrice,
  getPlanName,
  annualSavings,
} from "../domain/plan-prices";

// ── TRIAL_DAYS ────────────────────────────────────────────────────────────────

test("TRIAL_DAYS es 14, no 30", () => {
  assert.equal(TRIAL_DAYS, 14);
});

// ── Precios mensuales ────────────────────────────────────────────────────────

test("precios mensuales coinciden con los valores acordados", () => {
  assert.equal(PLAN_PRICES_MONTHLY.starter,  590);
  assert.equal(PLAN_PRICES_MONTHLY.pro,     1390);
  assert.equal(PLAN_PRICES_MONTHLY.business, 2290);
});

test("PLAN_PRICES (alias) apunta a los precios mensuales", () => {
  assert.equal(PLAN_PRICES.starter,  PLAN_PRICES_MONTHLY.starter);
  assert.equal(PLAN_PRICES.pro,      PLAN_PRICES_MONTHLY.pro);
  assert.equal(PLAN_PRICES.business, PLAN_PRICES_MONTHLY.business);
});

// ── Precios anuales ──────────────────────────────────────────────────────────

test("precios anuales coinciden con los valores acordados", () => {
  assert.equal(PLAN_PRICES_ANNUAL.starter,   5_880);
  assert.equal(PLAN_PRICES_ANNUAL.pro,      13_800);
  assert.equal(PLAN_PRICES_ANNUAL.business, 13_800);
});

test("precio anual es menor que 12 meses mensuales (hay descuento)", () => {
  for (const plan of ["starter", "pro", "business"] as const) {
    const monthly12 = PLAN_PRICES_MONTHLY[plan] * 12;
    assert.ok(
      PLAN_PRICES_ANNUAL[plan] < monthly12,
      `${plan}: precio anual ${PLAN_PRICES_ANNUAL[plan]} debe ser menor que 12 mensuales (${monthly12})`,
    );
  }
});

// ── Nombres de plan ──────────────────────────────────────────────────────────

test("nombres mensuales contienen 'Mensual'", () => {
  for (const plan of ["starter", "pro", "business"] as const) {
    assert.ok(
      PLAN_NAMES_MONTHLY[plan].includes("Mensual"),
      `${plan} mensual debe incluir 'Mensual' en el nombre`,
    );
  }
});

test("nombres anuales contienen 'Anual'", () => {
  for (const plan of ["starter", "pro", "business"] as const) {
    assert.ok(
      PLAN_NAMES_ANNUAL[plan].includes("Anual"),
      `${plan} anual debe incluir 'Anual' en el nombre`,
    );
  }
});

test("nombres mensuales y anuales son distintos (no colisionan en dLocal Go)", () => {
  for (const plan of ["starter", "pro", "business"] as const) {
    assert.notEqual(
      PLAN_NAMES_MONTHLY[plan],
      PLAN_NAMES_ANNUAL[plan],
      `${plan}: nombre mensual y anual deben ser distintos`,
    );
  }
});

// ── getPlanPrice helper ──────────────────────────────────────────────────────

test("getPlanPrice devuelve precio mensual correctamente", () => {
  assert.equal(getPlanPrice("starter",  "monthly"), 590);
  assert.equal(getPlanPrice("pro",      "monthly"), 1390);
  assert.equal(getPlanPrice("business", "monthly"), 2290);
});

test("getPlanPrice devuelve precio anual correctamente", () => {
  assert.equal(getPlanPrice("starter",  "annual"), 5_880);
  assert.equal(getPlanPrice("pro",      "annual"), 13_800);
  assert.equal(getPlanPrice("business", "annual"), 13_800);
});

// ── getPlanName helper ───────────────────────────────────────────────────────

test("getPlanName devuelve el nombre correcto por ciclo", () => {
  assert.equal(getPlanName("pro", "monthly"), PLAN_NAMES_MONTHLY.pro);
  assert.equal(getPlanName("pro", "annual"),  PLAN_NAMES_ANNUAL.pro);
});

// ── annualSavings helper ─────────────────────────────────────────────────────

test("annualSavings calcula el ahorro correctamente", () => {
  assert.equal(annualSavings("starter"),  590  * 12 - 5_880);
  assert.equal(annualSavings("pro"),      1390 * 12 - 13_800);
  assert.equal(annualSavings("business"), 2290 * 12 - 13_800);
});

test("annualSavings es positivo para todos los planes", () => {
  for (const plan of ["starter", "pro", "business"] as const) {
    assert.ok(annualSavings(plan) > 0, `${plan}: ahorro anual debe ser positivo`);
  }
});
