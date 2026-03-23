import { BarberRepository } from "../../infrastructure/database/BarberRepository";
import { Barber } from "../../domain/entities/Barber";

export class ListBarbersUseCase {
  constructor(private readonly barberRepository: BarberRepository) {}

  async execute(businessId: string): Promise<Barber[]> {
    return this.barberRepository.findByBusiness(businessId);
  }
}
