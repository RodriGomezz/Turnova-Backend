import { Barber } from "../entities/Barber";

export interface IBarberRepository {
  findById(id: string): Promise<Barber | null>;
  findByBusiness(businessId: string): Promise<Barber[]>;
  countByBusiness(businessId: string): Promise<number>;
  create(data: Partial<Barber>): Promise<Barber>;
  update(id: string, data: Partial<Barber>): Promise<Barber>;
  /** Soft delete — marca como inactivo, no elimina físicamente */
  deactivate(id: string): Promise<void>;
}
