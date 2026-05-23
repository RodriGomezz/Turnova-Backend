import { Barber } from "../entities/Barber";

export interface IBarberRepository {
  findById(id: string): Promise<Barber | null>;
  findByBusiness(businessId: string): Promise<Barber[]>;
  countByBusiness(businessId: string): Promise<number>;
  create(data: Partial<Barber>): Promise<Barber>;
  update(id: string, businessId: string, data: Partial<Barber>): Promise<Barber>;
  deactivate(id: string, businessId: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
}
