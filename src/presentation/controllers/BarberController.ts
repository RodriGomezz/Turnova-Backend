import { Request, Response, NextFunction } from "express";
import { BarberRepository }        from "../../infrastructure/database/BarberRepository";
import { BarberServiceRepository } from "../../infrastructure/database/BarberServiceRepository";
import { CreateBarberUseCase }     from "../../application/barbers/CreateBarberUseCase";
import { ListBarbersUseCase }      from "../../application/barbers/ListBarbersUseCase";
import { BusinessRepository }      from "../../infrastructure/database/BusinessRepository";
import { ServiceRepository }       from "../../infrastructure/database/ServiceRepository";
import {
  NotFoundError,
  ForbiddenError,
  AppError,
} from "../middlewares/errorHandler.middleware";
import { getPlanLimits }           from "../../domain/plan-limits";
import { CreateBarberInput, UpdateBarberInput } from "../schemas/barber.schema";
import { logger }                  from "../../infrastructure/logger";

export class BarberController {
  private readonly barberRepository:        BarberRepository;
  private readonly barberServiceRepository: BarberServiceRepository;
  private readonly businessRepository:      BusinessRepository;
  private readonly serviceRepository:       ServiceRepository;
  private readonly createBarberUseCase:     CreateBarberUseCase;
  private readonly listBarbersUseCase:      ListBarbersUseCase;

  constructor() {
    this.barberRepository        = new BarberRepository();
    this.barberServiceRepository = new BarberServiceRepository();
    this.businessRepository      = new BusinessRepository();
    this.serviceRepository       = new ServiceRepository();
    this.createBarberUseCase     = new CreateBarberUseCase(this.barberRepository);
    this.listBarbersUseCase      = new ListBarbersUseCase(this.barberRepository);
  }

  // ── GET /api/barbers ────────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barbers = await this.listBarbersUseCase.execute(req.businessId!);
      res.json({ barbers });
    } catch (error) {
      next(error);
    }
  };

  // ── POST /api/barbers ───────────────────────────────────────────────────────

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input    = req.body as CreateBarberInput;
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new AppError("Negocio no encontrado", 404);

      const trialActivo = business.trial_ends_at
        ? new Date(business.trial_ends_at) > new Date()
        : false;
      const limits = getPlanLimits(business.plan, trialActivo);
      const count  = await this.barberRepository.countByBusiness(req.businessId!);

      if (count >= limits.maxBarberos) {
        logger.warn("Límite de profesionales alcanzado", {
          businessId: req.businessId,
          plan:       business.plan,
          count,
          max:        limits.maxBarberos,
        });
        throw new AppError(
          `Tu plan ${business.plan} permite hasta ${limits.maxBarberos} ${
            limits.maxBarberos === 1 ? "profesional" : "profesionales"
          }. Actualizá tu plan para agregar más.`,
          403,
        );
      }

      const barber = await this.createBarberUseCase.execute({
        ...input,
        business_id: req.businessId!,
      });

      logger.info("Profesional creado", { businessId: req.businessId, barberId: barber.id });
      res.status(201).json({ barber });
    } catch (error) {
      next(error);
    }
  };

  // ── PUT /api/barbers/:id ────────────────────────────────────────────────────

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id    = req.params["id"] as string;
      const input = req.body as UpdateBarberInput;

      if (Object.keys(input).length === 0) {
        throw new AppError("No se enviaron campos para actualizar", 400);
      }

      const existing = await this.barberRepository.findById(id);
      if (!existing)                               throw new NotFoundError("Profesional");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const barber = await this.barberRepository.update(id, req.businessId!, input);
      res.json({ barber });
    } catch (error) {
      next(error);
    }
  };

  // ── DELETE /api/barbers/:id ─────────────────────────────────────────────────

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id       = req.params["id"] as string;
      const existing = await this.barberRepository.findById(id);
      if (!existing)                               throw new NotFoundError("Profesional");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const hardDelete = String(req.query["hard"] ?? "").toLowerCase() === "true";

      if (hardDelete) {
        await this.barberRepository.hardDelete(id);
        logger.info("Profesional eliminado permanentemente", { businessId: req.businessId, barberId: id });
        res.json({ message: "Profesional eliminado correctamente" });
        return;
      }

      if (!existing.activo) {
        res.json({ message: "Profesional ya estaba desactivado" });
        return;
      }

      await this.barberRepository.deactivate(id);
      logger.info("Profesional desactivado", { businessId: req.businessId, barberId: id });
      res.json({ message: "Profesional desactivado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── GET /api/barbers/:id/services ───────────────────────────────────────────
  // Devuelve los service_ids asignados al barbero.
  // Set vacío = sin restricción (hace todos los servicios del negocio).

  listServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barberId = req.params["id"] as string;

      const barber = await this.barberRepository.findById(barberId);
      if (!barber)                               throw new NotFoundError("Profesional");
      if (barber.business_id !== req.businessId) throw new ForbiddenError();

      const serviceIds = await this.barberServiceRepository.findServiceIdsByBarber(barberId);
      res.json({ serviceIds });
    } catch (error) {
      next(error);
    }
  };

  // ── POST /api/barbers/:id/services ─────────────────────────────────────────
  // Body: { service_id: string }
  // Asigna un servicio al barbero. Upsert — idempotente.

  addService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barberId  = req.params["id"] as string;
      const { service_id } = req.body as { service_id: string };

      if (!service_id) throw new AppError("service_id es requerido", 400);

      // Verificar ownership del barbero
      const barber = await this.barberRepository.findById(barberId);
      if (!barber)                               throw new NotFoundError("Profesional");
      if (barber.business_id !== req.businessId) throw new ForbiddenError();

      // Verificar que el servicio pertenece al mismo negocio
      const service = await this.serviceRepository.findById(service_id);
      if (!service)                               throw new NotFoundError("Servicio");
      if (service.business_id !== req.businessId) throw new ForbiddenError();

      await this.barberServiceRepository.add(barberId, service_id, req.businessId!);

      logger.info("Servicio asignado a profesional", {
        businessId: req.businessId,
        barberId,
        serviceId: service_id,
      });

      res.status(201).json({ message: "Servicio asignado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── DELETE /api/barbers/:id/services/:serviceId ─────────────────────────────
  // Quita la restricción de un servicio específico del barbero.

  removeService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const barberId  = req.params["id"]        as string;
      const serviceId = req.params["serviceId"] as string;

      // Verificar ownership del barbero
      const barber = await this.barberRepository.findById(barberId);
      if (!barber)                               throw new NotFoundError("Profesional");
      if (barber.business_id !== req.businessId) throw new ForbiddenError();

      await this.barberServiceRepository.remove(barberId, serviceId);

      logger.info("Servicio quitado de profesional", {
        businessId: req.businessId,
        barberId,
        serviceId,
      });

      res.json({ message: "Servicio quitado correctamente" });
    } catch (error) {
      next(error);
    }
  };
}