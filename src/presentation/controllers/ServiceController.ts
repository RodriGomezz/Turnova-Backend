import { Request, Response, NextFunction } from "express";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { CreateServiceUseCase } from "../../application/services/CreateServiceUseCase";
import { ReorderServicesUseCase } from "../../application/services/ReorderServicesUseCase";
import { NotFoundError, ForbiddenError, ValidationError } from "../../domain/errors";
import { CreateServiceInput, UpdateServiceInput, ReorderServicesInput } from "../schemas/service.schema";
import { invalidateByBusinessId } from "../../infrastructure/cache/public.cache";
import { invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";

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
      invalidateSlotsCache(req.businessId!);
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

      // El patch a Supabase es PARCIAL: una clave ausente en el body deja la
      // columna tal cual está en la base, no la resetea. Sin esto, editar
      // solo `duracion_minutos` (ej. de 30 a 120 min) sin tocar el toggle de
      // "tiempo de procesamiento" dejaba `tiempo_activo_inicial_minutos`
      // con el valor viejo (ej. 30, de cuando la duración total también era
      // 30) — ahora desincronizado de la nueva duración. computeActiveBlocks
      // interpretaba eso como "solo 30 min de atención activa + 90 min de
      // procesamiento libre", así que un barbero con capacidad_sillas > 1
      // liberaba esos 90 min para otro cliente en la agenda pública, aunque
      // el servicio en realidad no tiene fases — el turno completo debía
      // bloquear las 2 horas. CreateServiceUseCase ya resuelve esto mismo al
      // crear (ver su comentario); acá replicamos la misma resolución para
      // que un PATCH parcial nunca pueda dejar las fases desalineadas con
      // la duración vigente, sea cual sea el campo que el cliente mande.
      const duracionEfectiva = input.duracion_minutos ?? existing.duracion_minutos;
      const tiempoActivoInicial =
        input.tiempo_activo_inicial_minutos ?? duracionEfectiva;
      const tiempoProcesamiento = input.tiempo_procesamiento_minutos ?? 0;

      if (tiempoActivoInicial + tiempoProcesamiento > duracionEfectiva) {
        throw new ValidationError(
          "tiempo_activo_inicial_minutos + tiempo_procesamiento_minutos no puede superar duracion_minutos",
        );
      }

      const service = await this.serviceRepository.update(id, {
        ...input,
        tiempo_activo_inicial_minutos: tiempoActivoInicial,
        tiempo_procesamiento_minutos: tiempoProcesamiento,
      });
      invalidateByBusinessId(req.businessId!);
      // Sin esto, cambiar duracion_minutos de un servicio no se reflejaba
      // en la grilla de horarios ofrecida en la página pública hasta que
      // el cache de slots expirara solo (TTL 2 min): un servicio editado
      // de 30 a 120 min seguía mostrando/aceptando huecos de 30 min hasta
      // entonces, aunque el dato del servicio en sí (nombre, duración
      // mostrada en el selector) ya estuviera al día por invalidateByBusinessId.
      invalidateSlotsCache(req.businessId!);
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
      invalidateSlotsCache(req.businessId!);
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
      invalidateSlotsCache(req.businessId!);
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
      invalidateSlotsCache(req.businessId!);
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