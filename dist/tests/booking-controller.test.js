"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const BookingController_1 = require("../presentation/controllers/BookingController");
(0, node_test_1.default)("createPanel creates an owner booking with the current business", async () => {
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
        execute: async (input) => {
            strict_1.default.deepEqual(input, {
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
    const controller = new BookingController_1.BookingController({}, {
        findById: async () => ({ id: "barber-1", business_id: "biz-1", nombre: "Leo" }),
    }, {
        findById: async () => ({
            id: "service-1",
            business_id: "biz-1",
            nombre: "Corte",
            duracion_minutos: 45,
        }),
    }, {
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
    }, {}, createBookingUseCase, {}, {}, {
        sendBookingConfirmation: async () => undefined,
        sendBookingNotification: async () => undefined,
    });
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
    let jsonPayload;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            jsonPayload = payload;
            return this;
        },
    };
    let nextCalled = false;
    await controller.createPanel(req, res, () => {
        nextCalled = true;
    });
    strict_1.default.equal(nextCalled, false);
    strict_1.default.equal(statusCode, 201);
    strict_1.default.deepEqual(jsonPayload, {
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
//# sourceMappingURL=booking-controller.test.js.map