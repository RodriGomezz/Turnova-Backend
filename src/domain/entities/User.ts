export type UserRol = "owner" | "admin";

export interface User {
  id: string;
  business_id: string;
  email: string;
  nombre: string | null;
  rol: UserRol;
  /** ISO string del último acceso al dashboard. null si nunca inició sesión. */
  last_seen_at?: string | null;
  created_at: string;
}