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
  /**
   * Marca el servicio "Otros / Varios" creado automáticamente por negocio.
   * Se usa como service_id para booking_items que no corresponden a un
   * servicio de catálogo (productos, adicionales ad-hoc cobrados en el momento).
   * Cada negocio tiene como máximo uno (constraint único a nivel de BD).
   * No debe aparecer en la lista editable de servicios del panel.
   */
  es_generico: boolean;
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
  tipo_negocio: string;
}
