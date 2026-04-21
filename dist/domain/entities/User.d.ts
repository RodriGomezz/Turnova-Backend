export type UserRol = "owner" | "admin";
export interface User {
    id: string;
    business_id: string;
    email: string;
    nombre: string | null;
    rol: UserRol;
    created_at: string;
}
//# sourceMappingURL=User.d.ts.map