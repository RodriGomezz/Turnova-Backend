import { BlockedDate } from "../entities/BlockedDate";

export interface IBlockedDateRepository {
  isBlocked(
    businessId: string,
    barberId: string,
    fecha: string,
  ): Promise<boolean>;
  findByBusiness(businessId: string): Promise<BlockedDate[]>;
  create(data: Omit<BlockedDate, "id" | "created_at">): Promise<BlockedDate>;
  delete(id: string): Promise<void>;
}
