"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBarberUseCase = void 0;
class CreateBarberUseCase {
    constructor(barberRepository) {
        this.barberRepository = barberRepository;
    }
    async execute(input) {
        return this.barberRepository.create(input);
    }
}
exports.CreateBarberUseCase = CreateBarberUseCase;
//# sourceMappingURL=CreateBarberUseCase.js.map