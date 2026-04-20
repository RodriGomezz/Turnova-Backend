export type UserRol = 'owner' | 'admin';

export interface User {
  id: string;
  business_id: string;
  email: string;
  nombre: string | null;
  rol: UserRol;
  created_at: string;
}

export interface AuthResponse {
  token:          string;
  refresh_token?: string;
  expires_at?:    number;
  user: {
    id:    string;
    email: string;
  };
}

export interface BusinessSummary {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
}
