import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { ValidationError } from "../../domain/errors";

export interface ReorderBarbersInput {
  business_id: string;
  ordered_ids: string[];
}

/**
 * Persiste el nuevo orden de visualización de los profesionales de un
 * negocio — usado tanto por drag&drop como por los botones ↑/↓ del panel,
 * que mandan la misma forma de datos (la lista completa en su nuevo orden).
 * Mismo patrón que ReorderServicesUseCase.
 */
export class ReorderBarbersUseCase {
  constructor(private readonly barberRepository: IBarberRepository) {}

  async execute(input: ReorderBarbersInput): Promise<void> {
    if (input.ordered_ids.length === 0) {
      throw new ValidationError("ordered_ids no puede estar vacío");
    }

    const unique = new Set(input.ordered_ids);
    if (unique.size !== input.ordered_ids.length) {
      throw new ValidationError("ordered_ids contiene ids duplicados");
    }

    await this.barberRepository.reorder(input.business_id, input.ordered_ids);
  }
}
