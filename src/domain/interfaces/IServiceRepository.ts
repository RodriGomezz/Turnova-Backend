import { Service, ServiceDefault } from "../entities/Service";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
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