import { BlockedDate } from "../../domain/entities/BlockedDate";
export declare class BlockedDateRepository {
    private readonly table;
    findByBusiness(businessId: string): Promise<BlockedDate[]>;
    isBlocked(businessId: string, barberId: string, fecha: string): Promise<boolean>;
    create(data: Partial<BlockedDate>): Promise<BlockedDate>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=BlockedDateRepository.d.ts.map