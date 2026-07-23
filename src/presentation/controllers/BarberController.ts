import { Request, Response, NextFunction } from "express";
import { BarberRepository }        from "../../infrastructure/database/BarberRepository";
import { BarberServiceRepository } from "../../infrastructure/database/BarberServiceRepository";
import { CreateBarberUseCase }     from "../../application/barbers/CreateBarberUseCase";
import { ListBarbersUseCase }      from "../../application/barbers/ListBarbersUseCase";
import { ReorderBarbersUseCase }   from "../../application/barbers/ReorderBarbersUseCase";
import { BusinessRepository }      from "../../infrastructure/database/BusinessRepository";
import { ServiceRepository }       from "../../infrastructure/database/ServiceRepository";
import {
  NotFoundError,
  ForbiddenError,
  AppError,
} from "../middlewares/errorHandler.middleware";
import { getPlanLimits }           from "../../domain/plan-limits";
import { CreateBarberInput, UpdateBarberInput, ReorderBarbersInput } from "../schemas/barber.schema";
import { logger }                  from "../../infrastructure/logger";
import { invalidateByBusinessId }  from "../../infrastructure/cache/public.cache";
import { invalidateSlotsCache }    from "../../infrastructure/cache/slots.cache";

export class BarberController {
  private readonly barberRepository:        BarberRepository;
  private readonly barberServiceRepository: BarberServiceRepository;
  private readonly businessRepository:      BusinessRepository;
  private readonly serviceRepository:       ServiceRepository;
  private readonly createBarberUseCase:     CreateBarberUseCase;
  private readonly listBarbersUseCase:      ListBarbersUseCase;
  private readonly reorderBarbersUseCase:   ReorderBarbersUseCase;

  constructor() {
    this.barberRepository        = new BarberRepository();
    this.barberServiceRepository = new BarberServiceRepository();
    this.businessRepository      = new BusinessRepository();
    this.serviceRepository       = new ServiceRepository();
    this.createBarberUseCase     = new CreateBarberUseCase(this.barberRepository);
    this.listBarbersUseCase      = new ListBarbersUseCase(this.barberRepository);
    this.reorderBarbersUseCase   = new ReorderBarbersUseCase(this.barberRepository);
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
      invalidateByBusinessId(req.businessId!);
      invalidateSlotsCache(req.businessId!);
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
      // Este endpoint no invalidaba ningún cache. Dos campos que se editan
      // acá son especialmente sensibles: `activo` (el barbero puede
      // aparecer/desaparecer del picker público) y `capacidad_sillas`
      // (cambia el cálculo mismo de generateCandidateStartMinutes para
      // capacidadSillas > 1 — ver booking-scheduling.ts). Sin esto, un
      // barbero recién desactivado seguía siendo reservable en la página
      // pública hasta que el cache expirara solo (TTL 2 min).
      invalidateByBusinessId(req.businessId!);
      invalidateSlotsCache(req.businessId!);
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
        invalidateByBusinessId(req.businessId!);
        invalidateSlotsCache(req.businessId!);
        res.json({ message: "Profesional eliminado correctamente" });
        return;
      }

      if (!existing.activo) {
        res.json({ message: "Profesional ya estaba desactivado" });
        return;
      }

      await this.barberRepository.deactivate(id);
      logger.info("Profesional desactivado", { businessId: req.businessId, barberId: id });
      invalidateByBusinessId(req.businessId!);
      invalidateSlotsCache(req.businessId!);
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

      // El picker público (GET /public/:slug) manda el service_ids de cada
      // barbero, y la grilla de horarios se cachea por combinación
      // barbero+servicio — las dos quedaban desactualizadas hasta el TTL.
      invalidateByBusinessId(req.businessId!);
      invalidateSlotsCache(req.businessId!);
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

      // El más importante de los dos: sin esto, un cliente podía seguir
      // agendando este barbero para un servicio que le acabás de sacar,
      // porque la grilla de horarios cacheada para esa combinación
      // barbero+servicio todavía no sabía que ya no correspondía.
      invalidateByBusinessId(req.businessId!);
      invalidateSlotsCache(req.businessId!);
      res.json({ message: "Servicio quitado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── PUT /api/barbers/reorder ─────────────────────────────────────────────────
  // Persiste el nuevo orden tras un drag&drop o un click en ↑/↓ del panel.
  // Mismo contrato que ServiceController.reorder: la lista completa de ids
  // del negocio en su nuevo orden, no pares sueltos {id, orden}.

  reorder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as ReorderBarbersInput;

      // Defensa de pertenencia: todos los ids mandados deben ser
      // profesionales de ESTE negocio. Si alguno no lo es, se rechaza
      // entero en vez de reordenar parcialmente.
      const existing = await this.barberRepository.findByBusiness(req.businessId!);
      const ownIds = new Set(existing.map((b) => b.id));
      const allBelongToBusiness = input.ordered_ids.every((id) => ownIds.has(id));
      if (!allBelongToBusiness) throw new ForbiddenError();

      await this.reorderBarbersUseCase.execute({
        business_id: req.businessId!,
        ordered_ids: input.ordered_ids,
      });

      logger.info("Orden de profesionales actualizado", { businessId: req.businessId });
      res.json({ message: "Orden actualizado correctamente" });
    } catch (error) {
      next(error);
    }
  };
}