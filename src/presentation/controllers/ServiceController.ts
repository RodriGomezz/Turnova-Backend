import { Request, Response, NextFunction } from "express";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { CreateServiceUseCase } from "../../application/services/CreateServiceUseCase";
import { NotFoundError, ForbiddenError } from "../../domain/errors";
import { CreateServiceInput, UpdateServiceInput } from "../schemas/service.schema";

export class ServiceController {
  constructor(
    private readonly serviceRepository: IServiceRepository,
    private readonly createServiceUseCase: CreateServiceUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await this.serviceRepository.findByBusiness(req.businessId!);
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
      res.json({ service });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params["id"] as string;

      const existing = await this.serviceRepository.findById(id);
      if (!existing) throw new NotFoundError("Servicio");
      if (existing.business_id !== req.businessId) throw new ForbiddenError();

      await this.serviceRepository.deactivate(id);
      res.json({ message: "Servicio desactivado correctamente" });
    } catch (error) {
      next(error);
    }
  };
}
