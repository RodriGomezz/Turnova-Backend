import { Service, ServiceDefault } from "../entities/Service";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  /** Servicios cuyo id está en la lista dada, sin filtrar por business_id — el caller valida pertenencia. */
  findByIds(ids: string[]): Promise<Service[]>;
  findByBusiness(businessId: string): Promise<Service[]>;
  findAllByBusiness(businessId: string): Promise<Service[]>; // activos + inactivos
  /** Siguiente valor de orden disponible (máximo actual + 1) para un negocio. */
  getNextOrden(businessId: string): Promise<number>;
  create(data: Omit<Service, "id" | "activo" | "created_at">): Promise<Service>;
  update(id: string, data: Partial<Service>): Promise<Service>;
  /**
   * Reasigna orden a varios servicios de un mismo negocio en una sola
   * operación — usado por drag&drop y por los botones ↑/↓ del panel.
   * orderedIds es la lista completa de ids del negocio en su nuevo orden;
   * se persiste como su índice (0, 1, 2...) en esa lista.
   */
  reorder(businessId: string, orderedIds: string[]): Promise<void>;
  /** Soft delete — marca como inactivo */
  deactivate(id: string): Promise<void>;
  /** Reactiva un servicio desactivado */
  reactivate(id: string): Promise<Service>;
  /** Hard delete — elimina físicamente */
  hardDelete(id: string): Promise<void>;
  listDefaults(tipoNegocio?: string): Promise<ServiceDefault[]>;
}
