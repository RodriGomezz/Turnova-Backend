"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateServiceUseCase = void 0;
const errors_1 = require("../../domain/errors");
class CreateServiceUseCase {
    constructor(serviceRepository) {
        this.serviceRepository = serviceRepository;
    }
    async execute(input) {
        if (input.precio_hasta != null && input.precio_hasta < input.precio) {
            throw new errors_1.ValidationError("precio_hasta no puede ser menor que precio");
        }
        if (input.duracion_minutos < 5 || input.duracion_minutos > 480) {
            throw new errors_1.ValidationError("La duración debe estar entre 5 y 480 minutos");
        }
        return this.serviceRepository.create({
            business_id: input.business_id,
            nombre: input.nombre,
            descripcion: input.descripcion ?? null,
            incluye: input.incluye ?? null,
            duracion_minutos: input.duracion_minutos,
            precio: input.precio,
            precio_hasta: input.precio_hasta ?? null,
        });
    }
}
exports.CreateServiceUseCase = CreateServiceUseCase;
//# sourceMappingURL=CreateServiceUseCase.js.map