import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { ValidationError } from "../../domain/errors";

export interface ReorderServicesInput {
  business_id: string;
  ordered_ids: string[];
}

/**
 * Persiste el nuevo orden de visualización de los servicios de un negocio
 * — usado tanto por drag&drop como por los botones ↑/↓ del panel, que
 * mandan la misma forma de datos (la lista completa en su nuevo orden).
 * No reordena el servicio genérico "Otros / Varios": ese nunca se muestra
 * en esta lista (ver findAllByBusiness + filtro es_generico en frontend),
 * así que tampoco debería poder llegar acá.
 */
export class ReorderServicesUseCase {
  constructor(private readonly serviceRepository: IServiceRepository) {}

  async execute(input: ReorderServicesInput): Promise<void> {
    if (input.ordered_ids.length === 0) {
      throw new ValidationError("ordered_ids no puede estar vacío");
    }

    // Defensa contra ids duplicados en el payload — un duplicado dejaría
    // dos filas con el mismo índice de orden y una posición "fantasma"
    // sin nada asignado, silenciosamente.
    const unique = new Set(input.ordered_ids);
    if (unique.size !== input.ordered_ids.length) {
      throw new ValidationError("ordered_ids contiene ids duplicados");
    }

    await this.serviceRepository.reorder(input.business_id, input.ordered_ids);
  }
}
