import { Service, ServiceDefault } from "../../domain/entities/Service";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
export declare class ServiceRepository implements IServiceRepository {
    private readonly table;
    findById(id: string): Promise<Service | null>;
    findByBusiness(businessId: string): Promise<Service[]>;
    create(data: Omit<Service, "id" | "activo" | "created_at">): Promise<Service>;
    update(id: string, data: Partial<Service>): Promise<Service>;
    /** Soft delete — marca como inactivo, no elimina físicamente */
    deactivate(id: string): Promise<void>;
    listDefaults(tipoNegocio?: string): Promise<ServiceDefault[]>;
}
//# sourceMappingURL=ServiceRepository.d.ts.map