export interface Service {
  id: string;
  business_id: string;
  nombre: string;
  descripcion: string | null;
  incluye: string | null;
  duracion_minutos: number;
  precio: number;
  precio_hasta: number | null;
  /**
   * Minutos de atención activa del barbero al inicio del servicio (ej.
   * aplicar el color). 0 = todo el servicio es activo (comportamiento
   * histórico, default para todo servicio existente).
   */
  tiempo_activo_inicial_minutos: number;
  /**
   * Minutos donde el cliente no necesita atención del barbero (ej. color
   * fraguando). Durante esta ventana el barbero queda libre para otro
   * cliente en otra silla. 0 = sin ventana de procesamiento.
   * El tiempo de "acabado" (activo después del procesado) es el resto:
   * duracion_minutos - tiempo_activo_inicial_minutos - tiempo_procesamiento_minutos.
   */
  tiempo_procesamiento_minutos: number;
  activo: boolean;
  /** Posición de despliegue en la página pública y en el panel — menor primero. */
  orden: number;
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
