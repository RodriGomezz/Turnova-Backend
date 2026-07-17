import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { Barber } from "../../domain/entities/Barber";

export interface CreateBarberInput {
  business_id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  capacidad_sillas?: number;
}

export class CreateBarberUseCase {
  constructor(private readonly barberRepository: IBarberRepository) {}

  async execute(input: CreateBarberInput): Promise<Barber> {
    const orden = input.orden ?? (await this.barberRepository.getNextOrden(input.business_id));
    return this.barberRepository.create({ ...input, orden });
  }
}
