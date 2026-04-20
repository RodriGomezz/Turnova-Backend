export interface Service {
  id: string;
  business_id: string;
  nombre: string;
  descripcion: string | null;
  incluye: string | null;
  duracion_minutos: number;
  precio: number;
  precio_hasta: number | null;
  activo: boolean;
  created_at: string;
}

export interface ServiceDefault {
  id: string;
  nombre: string;
  descripcion: string | null;
  incluye: string | null;
  duracion_minutos: number;
  precio_sugerido: number;
  precio_hasta: number | null;
}