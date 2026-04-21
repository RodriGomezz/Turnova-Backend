export type BusinessPlan = 'starter' | 'pro' | 'business';
export type Tipografia = 'clasica' | 'moderna' | 'minimalista' | 'bold';
export type EstiloCards = 'destacado' | 'minimalista' | 'oscuro';

export interface Business {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;

  // Paleta — reemplaza color_primario y color_secundario
  color_fondo: string;
  color_acento: string;
  color_superficie: string;

  email: string | null;
  whatsapp: string | null;
  direccion: string | null;
  timezone: string;
  buffer_minutos: number;
  auto_confirmar: boolean;
  activo: boolean;
  plan: BusinessPlan;
  trial_ends_at: string;
  created_at: string;
  frase_bienvenida: string | null;
  hero_imagen_url: string | null;
  instagram: string | null;
  facebook: string | null;
  tipografia: Tipografia;
  estilo_cards: EstiloCards;
  tipo_negocio: string;
  termino_profesional: string;
  termino_profesional_plural: string;
  termino_servicio: string;
  termino_reserva: string;
  onboarding_completed: boolean;
}

export interface BusinessBranch {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  activo: boolean;
  plan: string;
  esPrincipal: boolean;
}