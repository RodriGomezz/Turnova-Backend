import { IUserBusinessAccess, UserBusinessSummary } from "../../domain/interfaces/IUserBusinessAccess";
export declare class UserBusinessAccessRepository implements IUserBusinessAccess {
    private readonly table;
    hasAccess(userId: string, businessId: string): Promise<boolean>;
    findByUser(userId: string): Promise<UserBusinessSummary[]>;
    findPrincipalBusinessId(userId: string): Promise<string | null>;
}
//# sourceMappingURL=UserBusinessAccessRepository.d.ts.map