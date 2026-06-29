import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { Service } from "../../domain/entities/Service";
import { ValidationError } from "../../domain/errors";

export interface CreateServiceInput {
  business_id: string;
  nombre: string;
  descripcion?: string | null;
  incluye?: string | null;
  duracion_minutos: number;
  precio: number;
  precio_hasta?: number | null;
}

export class CreateServiceUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(input: CreateServiceInput): Promise<Service> {
    if (input.precio_hasta != null && input.precio_hasta < input.precio) {
      throw new ValidationError("precio_hasta no puede ser menor que precio");
    }

    if (input.duracion_minutos < 5 || input.duracion_minutos > 480) {
      throw new ValidationError("La duración debe estar entre 5 y 480 minutos");
    }

    const orden = await this.serviceRepository.getNextOrden(input.business_id);

    return this.serviceRepository.create({
      business_id: input.business_id,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      incluye: input.incluye ?? null,
      duracion_minutos: input.duracion_minutos,
      precio: input.precio,
      precio_hasta: input.precio_hasta ?? null,
      orden,
      // Los servicios creados desde este flujo (panel del dueño) nunca son
      // el genérico del negocio — ese se crea una sola vez automáticamente
      // (CreateBusinessUseCase) y está protegido por un constraint único en
      // BD. CreateServiceInput no expone este campo a propósito, para que
      // nadie pueda crear un segundo "genérico" por error desde la API.
      es_generico: false,
    });
  }
}
