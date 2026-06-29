import { Request, Response, NextFunction } from "express";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { CreateServiceUseCase } from "../../application/services/CreateServiceUseCase";
import { ReorderServicesUseCase } from "../../application/services/ReorderServicesUseCase";
import { NotFoundError, ForbiddenError } from "../../domain/errors";
import { CreateServiceInput, UpdateServiceInput, ReorderServicesInput } from "../schemas/service.schema";
import { invalidateByBusinessId } from "../../infrastructure/cache/public.cache";

export class ServiceController {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly createServiceUseCase: CreateServiceUseCase,
    private readonly reorderServicesUseCase: ReorderServicesUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // El panel necesita ver activos e inactivos para mostrar el botón reactivar
      const services = await this.serviceRepository.findAllByBusiness(req.businessId!);
      res.json({ services });
    } catch (error) {
      next(error);
    }
  };

  listDefaults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tipoNegocio = req.query["tipo_negocio"] as string | undefined;
      const defaults = await this.serviceRepository.listDefaults(tipoNegocio);
      res.json({ defaults });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateServiceInput;
      const service = await this.createServiceUseCase.execute({
        ...input,
        business_id: req.businessId!,
      });
      invalidateByBusinessId(req.businessId!);
      res.status(201).json({ service });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;
      const input = req.body as UpdateServiceInput;

      const existing = await this.serviceRepository.findById(id);
      if (!existing) throw new NotFoundError("Servicio");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const service = await this.serviceRepository.update(id, input);
      invalidateByBusinessId(req.businessId!);
      res.json({ service });
    } catch (error) {
      next(error);
    }
  };

  // Soft delete — desactiva el servicio (activo = false)
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.serviceRepository.findById(id);
      if (!existing) throw new NotFoundError("Servicio");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.serviceRepository.deactivate(id);
      invalidateByBusinessId(req.businessId!);
      res.json({ message: "Servicio desactivado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // Reactiva un servicio desactivado
  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.serviceRepository.findById(id);
      if (!existing) throw new NotFoundError("Servicio");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      const service = await this.serviceRepository.reactivate(id);
      invalidateByBusinessId(req.businessId!);
      res.json({ service });
    } catch (error) {
      next(error);
    }
  };

  // Hard delete — elimina físicamente el servicio
  hardDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.serviceRepository.findById(id);
      if (!existing) throw new NotFoundError("Servicio");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.serviceRepository.hardDelete(id);
      invalidateByBusinessId(req.businessId!);
      res.json({ message: "Servicio eliminado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /services/reorder
   * Persiste el nuevo orden tras un drag&drop o un click en ↑/↓ del panel.
   * El frontend manda la lista completa de ids del negocio en su nuevo
   * orden — no pares sueltos {id, orden} — para que sea imposible mandar
   * valores duplicados o con huecos desde el cliente.
   */
  reorder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as ReorderServicesInput;

      // Defensa de pertenencia: todos los ids mandados deben ser servicios
      // de ESTE negocio. Si alguno no lo es (id ajeno, o typo), se rechaza
      // entero en vez de reordenar parcialmente — evita un estado a medias.
      const existing = await this.serviceRepository.findAllByBusiness(req.businessId!);
      const ownIds = new Set(existing.map((s) => s.id));
      const allBelongToBusiness = input.ordered_ids.every((id) => ownIds.has(id));
      if (!allBelongToBusiness) throw new ForbiddenError();

      await this.reorderServicesUseCase.execute({
        business_id: req.businessId!,
        ordered_ids: input.ordered_ids,
      });
      invalidateByBusinessId(req.businessId!);
      res.json({ message: "Orden actualizado correctamente" });
    } catch (error) {
      next(error);
    }
  };
}