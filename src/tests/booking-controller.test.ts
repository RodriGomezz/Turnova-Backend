import assert from "node:assert/strict";
import test from "node:test";
import { BookingController } from "../presentation/controllers/BookingController";

test("createPanel creates an owner booking with the current business", async () => {
  const booking = {
    id: "booking-1",
    business_id: "biz-1",
    barber_id: "barber-1",
    service_id: "service-1",
    cliente_nombre: "Juan",
    cliente_email: "juan@test.com",
    cliente_telefono: "099000000",
    fecha: "2026-04-21",
    hora_inicio: "10:00",
    hora_fin: "10:45",
    estado: "confirmada",
    cancellation_token: "token",
    reminder_sent_at: null,
    created_at: "2026-04-21T00:00:00.000Z",
  };

  const createBookingUseCase = {
    execute: async (input: unknown) => {
      assert.deepEqual(input, {
        business_id: "biz-1",
        barber_id: "barber-1",
        service_id: "service-1",
        cliente_nombre: "Juan",
        cliente_email: "juan@test.com",
        cliente_telefono: "099000000",
        fecha: "2026-04-21",
        hora_inicio: "10:00",
        hora_fin: "10:45",
        duracion_minutos: 45,
        buffer_minutos: 15,
        auto_confirmar: true,
      });
      return booking;
    },
  };

  const controller = new BookingController(
    {} as never,
    {
      findById: async () => ({ id: "barber-1", business_id: "biz-1", nombre: "Leo" }),
    } as never,
    {
      findById: async () => ({
        id: "service-1",
        business_id: "biz-1",
        nombre: "Corte",
        duracion_minutos: 45,
      }),
    } as never,
    {
      findById: async () => ({
        id: "biz-1",
        slug: "test0",
        nombre: "Test 0",
        email: "owner@test.com",
        plan: "starter",
        trial_ends_at: null,
        buffer_minutos: 15,
        auto_confirmar: true,
        activo: true,
      }),
    } as never,
    {} as never,
    createBookingUseCase as never,
    {} as never,
    {} as never,
    {
      sendBookingConfirmation: async () => undefined,
      sendBookingNotification: async () => undefined,
    } as never,
  );

  const req = {
    businessId: "biz-1",
    body: {
      barber_id: "barber-1",
      service_id: "service-1",
      cliente_nombre: "Juan",
      cliente_email: "juan@test.com",
      cliente_telefono: "099000000",
      fecha: "2026-04-21",
      hora_inicio: "10:00",
    },
  };

  let statusCode = 200;
  let jsonPayload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return this;
    },
  };

  let nextCalled = false;
  await controller.createPanel(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 201);
  assert.deepEqual(jsonPayload, {
    message: "Turno creado exitosamente",
    booking: {
      id: "booking-1",
      fecha: "2026-04-21",
      hora_inicio: "10:00",
      hora_fin: "10:45",
      estado: "confirmada",
      cancellation_token: "token",
    },
  });
});
