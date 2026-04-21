import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { Service } from "../../domain/entities/Service";
export interface CreateServiceInput {
    business_id: string;
    nombre: string;
    descripcion?: string | null;
    incluye?: string | null;
    duracion_minutos: number;
    precio: number;
    precio_hasta?: number | null;
}
export declare class CreateServiceUseCase {
    private readonly serviceRepository;
    constructor(serviceRepository: IServiceRepository);
    execute(input: CreateServiceInput): Promise<Service>;
}
//# sourceMappingURL=CreateServiceUseCase.d.ts.map