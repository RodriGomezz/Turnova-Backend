export interface Barber {
  id: string;
  business_id: string;
  nombre: string;
  foto_url: string | null;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
}