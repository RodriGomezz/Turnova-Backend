import { Business } from "../../domain/entities/Business";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
export declare class BusinessRepository implements IBusinessRepository {
    private readonly table;
    findById(id: string): Promise<Business | null>;
    /** Sin filtro `activo` — la capa de aplicación decide qué hacer con negocios pausados */
    findBySlug(slug: string): Promise<Business | null>;
    findByCustomDomain(domain: string): Promise<Business | null>;
    findByAnyCustomDomain(domain: string): Promise<Business | null>;
    create(data: Omit<Business, "id" | "created_at" | "domain_verified" | "domain_verified_at" | "domain_added_at" | "onboarding_completed">): Promise<Business>;
    update(id: string, data: Partial<Business>): Promise<Business>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=BusinessRepository.d.ts.map