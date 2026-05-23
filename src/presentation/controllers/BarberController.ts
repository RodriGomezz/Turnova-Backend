import { Request, Response, NextFunction } from "express";
import { BarberRepository } from "../../infrastructure/database/BarberRepository";
import { CreateBarberUseCase } from "../../application/barbers/CreateBarberUseCase";
import { ListBarbersUseCase } from "../../application/barbers/ListBarbersUseCase";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import {
  NotFoundError,
  ForbiddenError,
  AppError,

} from "../middlewares/errorHandler.middleware";
import { getPlanLimits } from "../../domain/plan-limits";
import { CreateBarberInput, UpdateBarberInput } from "../schemas/barber.schema";
import { BookingRepository } from "../../infrastructure/database/BookingRepository";

export class BarberController {
  private readonly barberRepository: BarberRepository;
  private readonly businessRepository: BusinessRepository;
  private readonly createBarberUseCase: CreateBarberUseCase;
  private readonly listBarbersUseCase: ListBarbersUseCase;
  private readonly bookingRepository:  BookingRepository; 

  constructor() {
    this.barberRepository = new BarberRepository();
    this.businessRepository = new BusinessRepository();
    this.createBarberUseCase = new CreateBarberUseCase(this.barberRepository);
    this.listBarbersUseCase = new ListBarbersUseCase(this.barberRepository);
    this.bookingRepository  = new BookingRepository();
  }

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const barbers = await this.listBarbersUseCase.execute(req.businessId!);
      res.json({ barbers });
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = req.body as CreateBarberInput;
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new AppError("Negocio no encontrado", 404);

      const trialActivo = business.trial_ends_at
        ? new Date(business.trial_ends_at) > new Date()
        : false;
      const limits = getPlanLimits(business.plan, trialActivo);
      const count = await this.barberRepository.countByBusiness(
        req.businessId!,
      );

      if (count >= limits.maxBarberos) {
        throw new AppError(
          `Tu plan ${business.plan} permite hasta ${limits.maxBarberos} ${limits.maxBarberos === 1 ? "profesional" : "profesionales"}. Actualizá tu plan para agregar más.`,
          403,
        );
      }

      const barber = await this.createBarberUseCase.execute({
        ...input,
        business_id: req.businessId!,
      });
      res.status(201).json({ barber });
    } catch (error) {
      next(error);
    }
  };

update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id    = req.params['id'] as string;
    const input = req.body as UpdateBarberInput;

    // Zod ya validó, pero si el body llegó vacío es un 400, no un 500
    if (Object.keys(input).length === 0) {
      throw new AppError('No se enviaron campos para actualizar', 400);
    }

    const existing = await this.barberRepository.findById(id);
    if (!existing)                              throw new NotFoundError('Profesional');
    if (existing.business_id !== req.businessId) throw new ForbiddenError();

    const barber = await this.barberRepository.update(id, req.businessId!, input);
    res.json({ barber });
  } catch (error) {
    next(error);
  }
};

 
// BarberController.ts — delete method

delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    console.log('[DELETE] 1. inicio - id:', id, 'businessId:', req.businessId);

    const existing = await this.barberRepository.findById(id);
    console.log('[DELETE] 2. findById result:', existing);

    if (!existing)                               throw new NotFoundError('Profesional');
    if (existing.business_id !== req.businessId) throw new ForbiddenError();

    console.log('[DELETE] 3. ownership OK - activo:', existing.activo);

    const hardDelete = String(req.query['hard'] ?? '').toLowerCase() === 'true';
    console.log('[DELETE] 4. hardDelete:', hardDelete);

    if (hardDelete) {
      console.log('[DELETE] 5. ejecutando hard delete');
      await this.barberRepository.hardDelete(id);
      console.log('[DELETE] 6. hard delete completado');
      res.json({ message: 'Profesional eliminado correctamente' });
      return;
    }

    // Early return solo aplica para soft delete
    if (!existing.activo) {
      console.log('[DELETE] 7. ya inactivo - early return soft delete');
      res.json({ message: 'Profesional ya estaba desactivado' });
      return;
    }

    console.log('[DELETE] 8. ejecutando deactivate');
    await this.barberRepository.deactivate(id);
    console.log('[DELETE] 9. deactivate completado');
    res.json({ message: 'Profesional desactivado correctamente' });
  } catch (error) {
    console.log('[DELETE] ERROR:', error);
    next(error);
  }
};
}
