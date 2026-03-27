import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { Barber } from "../../domain/entities/Barber";

export interface CreateBarberInput {
  business_id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export class CreateBarberUseCase {
  constructor(private readonly barberRepository: IBarberRepository) {}

  async execute(input: CreateBarberInput): Promise<Barber> {
    return this.barberRepository.create(input);
  }
}
