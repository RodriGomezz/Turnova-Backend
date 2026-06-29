import { Barber } from "../entities/Barber";

export interface IBarberRepository {
  findById(id: string): Promise<Barber | null>;
  findByBusiness(businessId: string): Promise<Barber[]>;
  countByBusiness(businessId: string): Promise<number>;
  /** Siguiente valor de orden disponible (máximo actual + 1) para un negocio. */
  getNextOrden(businessId: string): Promise<number>;
  create(data: Partial<Barber>): Promise<Barber>;
  update(id: string, businessId: string, data: Partial<Barber>): Promise<Barber>;
  deactivate(id: string, businessId: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  /**
   * Reasigna orden a varios profesionales de un mismo negocio en una sola
   * operación — usado por drag&drop y por los botones ↑/↓ del panel.
   * orderedIds es la lista completa de ids del negocio en su nuevo orden;
   * se persiste como su índice (0, 1, 2...) en esa lista.
   */
  reorder(businessId: string, orderedIds: string[]): Promise<void>;
}
