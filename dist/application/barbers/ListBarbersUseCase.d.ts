import { BarberRepository } from "../../infrastructure/database/BarberRepository";
import { Barber } from "../../domain/entities/Barber";
export declare class ListBarbersUseCase {
    private readonly barberRepository;
    constructor(barberRepository: BarberRepository);
    execute(businessId: string): Promise<Barber[]>;
}
//# sourceMappingURL=ListBarbersUseCase.d.ts.map