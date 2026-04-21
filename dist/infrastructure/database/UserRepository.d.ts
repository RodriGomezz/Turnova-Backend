import { User } from '../../domain/entities/User';
export declare class UserRepository {
    private table;
    findById(id: string): Promise<User | null>;
    findByBusinessId(businessId: string): Promise<User | null>;
    create(data: Partial<User>): Promise<User>;
    update(id: string, data: Partial<User>): Promise<User>;
    findBusinessesByUserId(userId: string): Promise<{
        id: string;
        nombre: string;
        slug: string;
        logo_url: string | null;
    }[]>;
    addBusinessAccess(userId: string, businessId: string): Promise<void>;
}
//# sourceMappingURL=UserRepository.d.ts.map