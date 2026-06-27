import { Service, ServiceDefault } from "../entities/Service";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  /** Servicios cuyo id está en la lista dada, sin filtrar por business_id — el caller valida pertenencia. */
  findByIds(ids: string[]): Promise<Service[]>;
  /** El servicio "Otros / Varios" del negocio, usado para booking_items sin catálogo. */
  findGenerico(businessId: string): Promise<Service>;
  findByBusiness(businessId: string): Promise<Service[]>;
  findAllByBusiness(businessId: string): Promise<Service[]>; // activos + inactivos
  create(data: Omit<Service, "id" | "activo" | "created_at">): Promise<Service>;
  update(id: string, data: Partial<Service>): Promise<Service>;
  /** Soft delete — marca como inactivo */
  deactivate(id: string): Promise<void>;
  /** Reactiva un servicio desactivado */
  reactivate(id: string): Promise<Service>;
  /** Hard delete — elimina físicamente */
  hardDelete(id: string): Promise<void>;
  listDefaults(tipoNegocio?: string): Promise<ServiceDefault[]>;
}
