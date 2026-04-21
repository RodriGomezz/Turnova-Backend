import { User } from "../entities/User";
export interface IUserRepository {
    findById(id: string): Promise<User | null>;
    create(data: Omit<User, "created_at">): Promise<User>;
    update(id: string, data: Partial<User>): Promise<User>;
    addBusinessAccess(userId: string, businessId: string): Promise<void>;
}
//# sourceMappingURL=IUserRepository.d.ts.map