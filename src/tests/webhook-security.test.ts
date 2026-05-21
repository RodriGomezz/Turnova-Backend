import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { WebhookController } from "../presentation/controllers/WebhookController";
import { HandleWebhookUseCase } from "../application/subscriptions/HandleWebhookUseCase";
import { AppError } from "../domain/errors";

// ── Helpers para simular req/res de Express ──────────────────────────────────

function makeReqRes(body: Buffer, headers: Record<string, string> = {}) {
  const req = {
    body,
    headers,
    ip: "1.2.3.4",
  } as any;

  const resData: { statusCode?: number; json?: unknown } = {};
  const res = {
    status(code: number) { resData.statusCode = code; return this; },
    json(data: unknown)  { resData.json = data; return this; },
  } as any;

  const next = (err?: unknown) => { resData.json = { error: err }; };

  return { req, res, resData, next };
}

// ── Stub mínimo de HandleWebhookUseCase ─────────────────────────────────────

function makeUseCase(executed: { called: boolean }) {
  return {
    execute: async () => { executed.called = true; },
  } as unknown as HandleWebhookUseCase;
}

// ── Tests de firma ───────────────────────────────────────────────────────────

test("SEC-001: webhook sin X-Signature retorna 200 pero NO ejecuta el use case", async () => {
  process.env.DLOCAL_SECRET_KEY = "test_secret";
  const executed = { called: false };
  const controller = new WebhookController(makeUseCase(executed));

  const body = Buffer.from(JSON.stringify({ externalId: "sub_1", invoiceId: "inv_1" }));
  const { req, res, resData, next } = makeReqRes(body, {}); // sin X-Signature

  await controller.handleDLocal(req, res, next);

  assert.equal(resData.statusCode, 200, "debe responder 200 para no disparar reintentos");
  assert.equal(executed.called, false, "NO debe ejecutar el use case sin firma");
});

test("SEC-001: webhook con firma válida ejecuta el use case", async () => {
  const secret = "test_secret_valid";
  process.env.DLOCAL_SECRET_KEY = secret;

  const executed = { called: false };
  const controller = new WebhookController(makeUseCase(executed));

  const payload = JSON.stringify({ externalId: "sub_1", invoiceId: "inv_1" });
  const body = Buffer.from(payload);
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const { req, res, resData, next } = makeReqRes(body, { "x-signature": signature });

  await controller.handleDLocal(req, res, next);

  assert.equal(executed.called, true, "debe ejecutar el use case con firma válida");
  assert.equal(resData.statusCode, 200);
});

test("SEC-001: webhook con firma inválida lanza AppError 401 y NO ejecuta el use case", async () => {
  const secret = "test_secret_invalid_sig";
  process.env.DLOCAL_SECRET_KEY = secret;

  const executed = { called: false };
  const controller = new WebhookController(makeUseCase(executed));

  const body = Buffer.from(JSON.stringify({ externalId: "sub_1" }));
  const badSignature = "aaaa1234aaaa1234aaaa1234aaaa1234aaaa1234aaaa1234aaaa1234aaaa1234";

  const { req, res, resData, next } = makeReqRes(body, { "x-signature": badSignature });

  await controller.handleDLocal(req, res, next);

  assert.equal(executed.called, false, "NO debe ejecutar el use case con firma inválida");
  // next fue llamado con el error
  assert.ok(
    (resData.json as any)?.error instanceof AppError,
    "debe propagar AppError al errorHandler",
  );
});

test("SEC-001: DLOCAL_SECRET_KEY ausente resulta en error 500, no en skip silencioso", async () => {
  delete process.env.DLOCAL_SECRET_KEY;

  const executed = { called: false };
  const controller = new WebhookController(makeUseCase(executed));

  const body = Buffer.from(JSON.stringify({ externalId: "sub_1" }));
  const { req, res, resData, next } = makeReqRes(body, { "x-signature": "cualquier_firma" });

  await controller.handleDLocal(req, res, next);

  assert.equal(executed.called, false, "NO debe ejecutar el use case sin secret configurado");
  const err = (resData.json as any)?.error as AppError;
  assert.ok(err instanceof AppError);
  assert.equal(err.statusCode, 500);
});

test("SEC-001: payload JSON inválido con firma válida retorna 200 sin procesar", async () => {
  const secret = "test_secret_bad_json";
  process.env.DLOCAL_SECRET_KEY = secret;

  const executed = { called: false };
  const controller = new WebhookController(makeUseCase(executed));

  const body = Buffer.from("not-json-at-all");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const { req, res, resData, next } = makeReqRes(body, { "x-signature": signature });

  await controller.handleDLocal(req, res, next);

  assert.equal(resData.statusCode, 200);
  assert.equal(executed.called, false);
});

test("SEC-001: payload sin identificadores con firma válida retorna 200 sin procesar", async () => {
  const secret = "test_secret_no_id";
  process.env.DLOCAL_SECRET_KEY = secret;

  const executed = { called: false };
  const controller = new WebhookController(makeUseCase(executed));

  const body = Buffer.from(JSON.stringify({ mid: 4232 })); // sin external_id, sin invoiceId, etc.
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const { req, res, resData, next } = makeReqRes(body, { "x-signature": signature });

  await controller.handleDLocal(req, res, next);

  assert.equal(resData.statusCode, 200);
  assert.equal(executed.called, false);
});
