export interface UserBusinessSummary {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  activo: boolean;
  plan: string;
  created_at: string;
  esPrincipal: boolean;
}

export interface IUserBusinessAccess {
  hasAccess(userId: string, businessId: string): Promise<boolean>;
  findByUser(userId: string): Promise<UserBusinessSummary[]>;
  /** Devuelve el business_id del negocio más antiguo del usuario (el principal) */
  findPrincipalBusinessId(userId: string): Promise<string | null>;
}
