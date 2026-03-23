import { ServiceRepository } from "../../infrastructure/database/ServiceRepository";
import { Service } from "../../domain/entities/Service";
import { ValidationError } from "../../domain/errors";

interface CreateServiceInput {
  business_id: string;
  nombre: string;
  descripcion?: string;
  incluye?: string;
  duracion_minutos: number;
  precio: number;
  precio_hasta?: number;
}

export class CreateServiceUseCase {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async execute(input: CreateServiceInput): Promise<Service> {
    if (input.precio_hasta !== undefined && input.precio_hasta < input.precio) {
      throw new ValidationError("precio_hasta no puede ser menor que precio");
    }

    if (input.duracion_minutos < 5 || input.duracion_minutos > 480) {
      throw new ValidationError("La duración debe estar entre 5 y 480 minutos");
    }

    return this.serviceRepository.create(input);
  }
}
