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

export class BarberController {
  private readonly barberRepository: BarberRepository;
  private readonly businessRepository: BusinessRepository;
  private readonly createBarberUseCase: CreateBarberUseCase;
  private readonly listBarbersUseCase: ListBarbersUseCase;

  constructor() {
    this.barberRepository = new BarberRepository();
    this.businessRepository = new BusinessRepository();
    this.createBarberUseCase = new CreateBarberUseCase(this.barberRepository);
    this.listBarbersUseCase = new ListBarbersUseCase(this.barberRepository);
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

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const input = req.body as UpdateBarberInput;

      const existing = await this.barberRepository.findById(id);
      if (!existing) throw new NotFoundError("Profesional");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const barber = await this.barberRepository.update(id, input);
      res.json({ barber });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.barberRepository.findById(id);
      if (!existing) throw new NotFoundError("Profesional");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.barberRepository.deactivate(id);
      res.json({ message: "Profesional desactivado correctamente" });
    } catch (error) {
      next(error);
    }
  };
}
