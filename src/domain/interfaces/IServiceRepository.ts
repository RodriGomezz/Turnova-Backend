import { Service, ServiceDefault } from "../entities/Service";

export interface IServiceRepository {
  findById(id: string): Promise<Service | null>;
  findByBusiness(businessId: string): Promise<Service[]>;
  create(data: Omit<Service, "id" | "activo" | "created_at">): Promise<Service>;
  update(id: string, data: Partial<Service>): Promise<Service>;
  /** Soft delete — marca como inactivo, no elimina físicamente */
  deactivate(id: string): Promise<void>;
  listDefaults(tipoNegocio?: string): Promise<ServiceDefault[]>;
}
