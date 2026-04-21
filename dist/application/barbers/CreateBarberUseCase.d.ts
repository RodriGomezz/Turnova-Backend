import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { Barber } from "../../domain/entities/Barber";
export interface CreateBarberInput {
    business_id: string;
    nombre: string;
    descripcion?: string;
    orden?: number;
}
export declare class CreateBarberUseCase {
    private readonly barberRepository;
    constructor(barberRepository: IBarberRepository);
    execute(input: CreateBarberInput): Promise<Barber>;
}
//# sourceMappingURL=CreateBarberUseCase.d.ts.map