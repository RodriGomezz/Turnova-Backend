export interface Barber {
  id: string;
  business_id: string;
  nombre: string;
  foto_url: string | null;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  /**
   * Cantidad de sillas/estaciones físicas que este barbero puede usar en
   * simultáneo (ej. 2 = puede tener un color procesando en una silla y
   * atender un corte en otra). 1 = comportamiento histórico, sin cambios.
   */
  capacidad_sillas: number;
  created_at: string;
}