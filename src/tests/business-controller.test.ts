import assert from "node:assert/strict";
import test from "node:test";

test("deactivate switches the current business to another active branch", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY ??= "test-secret";
  const { BusinessController } = await import("../presentation/controllers/BusinessController");
  const updates: Array<{ id: string; input: unknown }> = [];

  const controller = new BusinessController(
    {
      findById: async () => null,
      update: async (id: string, input: unknown) => {
        updates.push({ id, input });
        return null;
      },
    } as never,
    {} as never,
    {
      findById: async () => ({ id: "user-1", business_id: "biz-1" }),
      update: async (id: string, input: unknown) => {
        updates.push({ id, input });
        return null;
      },
    } as never,
    {
      hasAccess: async () => true,
      findByUser: async () => [
        {
          id: "biz-1",
          nombre: "Principal",
          slug: "principal",
          logo_url: null,
          activo: true,
          plan: "business",
          created_at: "2026-01-01T00:00:00.000Z",
          esPrincipal: true,
        },
        {
          id: "biz-2",
          nombre: "Centro",
          slug: "centro",
          logo_url: null,
          activo: true,
          plan: "business",
          created_at: "2026-02-01T00:00:00.000Z",
          esPrincipal: false,
        },
      ],
      findPrincipalBusinessId: async () => "biz-1",
    } as never,
  );

  const req = {
    userId: "user-1",
    params: { id: "biz-1" },
  };

  let payload: unknown;
  const res = {
    json(body: unknown) {
      payload = body;
      return this;
    },
  };

  let nextError: unknown = null;
  await controller.deactivate(req as never, res as never, (error?: unknown) => {
    nextError = error ?? null;
  });

  assert.equal(nextError, null);
  assert.deepEqual(payload, { message: "Sucursal desactivada correctamente" });
  assert.deepEqual(updates, [
    { id: "biz-1", input: { activo: false } },
    { id: "user-1", input: { business_id: "biz-2" } },
  ]);
});

test("deactivate blocks the current branch when there is no active fallback", async () => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY ??= "test-secret";
  const { BusinessController } = await import("../presentation/controllers/BusinessController");
  const controller = new BusinessController(
    {
      findById: async () => null,
      update: async () => null,
    } as never,
    {} as never,
    {
      findById: async () => ({ id: "user-1", business_id: "biz-1" }),
      update: async () => null,
    } as never,
    {
      hasAccess: async () => true,
      findByUser: async () => [
        {
          id: "biz-1",
          nombre: "Principal",
          slug: "principal",
          logo_url: null,
          activo: true,
          plan: "business",
          created_at: "2026-01-01T00:00:00.000Z",
          esPrincipal: true,
        },
      ],
      findPrincipalBusinessId: async () => "biz-1",
    } as never,
  );

  const req = {
    userId: "user-1",
    params: { id: "biz-1" },
  };

  let nextError: any = null;
  await controller.deactivate(req as never, {} as never, (error?: unknown) => {
    nextError = error ?? null;
  });

  assert.equal(nextError?.statusCode, 400);
  assert.equal(
    nextError?.message,
    "Necesitas otra sucursal activa antes de desactivar la actual.",
  );
});
