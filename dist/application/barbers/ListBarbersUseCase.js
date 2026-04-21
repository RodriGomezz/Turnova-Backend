"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListBarbersUseCase = void 0;
class ListBarbersUseCase {
    constructor(barberRepository) {
        this.barberRepository = barberRepository;
    }
    async execute(businessId) {
        return this.barberRepository.findByBusiness(businessId);
    }
}
exports.ListBarbersUseCase = ListBarbersUseCase;
//# sourceMappingURL=ListBarbersUseCase.js.map