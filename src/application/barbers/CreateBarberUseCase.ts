import { BarberRepository } from "../../infrastructure/database/BarberRepository";
import { Barber } from "../../domain/entities/Barber";

interface CreateBarberInput {
  business_id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export class CreateBarberUseCase {
  constructor(private readonly barberRepository: BarberRepository) {}

  async execute(input: CreateBarberInput): Promise<Barber> {
    return this.barberRepository.create(input);
  }
}
