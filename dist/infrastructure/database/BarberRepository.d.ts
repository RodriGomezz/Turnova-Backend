import { Barber } from "../../domain/entities/Barber";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
export declare class BarberRepository implements IBarberRepository {
    private readonly table;
    findById(id: string): Promise<Barber | null>;
    findByBusiness(businessId: string): Promise<Barber[]>;
    countByBusiness(businessId: string): Promise<number>;
    create(data: Partial<Barber>): Promise<Barber>;
    update(id: string, data: Partial<Barber>): Promise<Barber>;
    /** Soft delete — marca como inactivo, no elimina físicamente */
    deactivate(id: string): Promise<void>;
}
//# sourceMappingURL=BarberRepository.d.ts.map