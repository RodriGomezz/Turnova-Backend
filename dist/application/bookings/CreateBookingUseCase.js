"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBookingUseCase = void 0;
const errors_1 = require("../../domain/errors");
class CreateBookingUseCase {
    constructor(bookingRepository, getAvailableSlotsUseCase) {
        this.bookingRepository = bookingRepository;
        this.getAvailableSlotsUseCase = getAvailableSlotsUseCase;
    }
    async execute(input) {
        const slotsInput = {
            barberId: input.barber_id,
            businessId: input.business_id,
            fecha: input.fecha,
            duracionMinutos: input.duracion_minutos,
            bufferMinutos: input.buffer_minutos,
        };
        const slots = await this.getAvailableSlotsUseCase.execute(slotsInput);
        const slotDisponible = slots.find((s) => s.hora_inicio === input.hora_inicio && s.disponible);
        if (!slotDisponible) {
            throw new errors_1.ConflictError(`El horario ${input.hora_inicio} del ${input.fecha} ya no está disponible`);
        }
        return this.bookingRepository.create({
            business_id: input.business_id,
            barber_id: input.barber_id,
            service_id: input.service_id,
            cliente_nombre: input.cliente_nombre,
            cliente_email: input.cliente_email,
            cliente_telefono: input.cliente_telefono,
            fecha: input.fecha,
            hora_inicio: input.hora_inicio,
            hora_fin: input.hora_fin,
            estado: input.auto_confirmar ? "confirmada" : "pendiente",
        });
    }
}
exports.CreateBookingUseCase = CreateBookingUseCase;
//# sourceMappingURL=CreateBookingUseCase.js.map