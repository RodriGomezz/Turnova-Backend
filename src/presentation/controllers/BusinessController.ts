import { Request, Response, NextFunction } from "express";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { IUserBusinessAccess } from "../../domain/interfaces/IUserBusinessAccess";
import { AppError, NotFoundError } from "../../domain/errors";
import { getPlanLimits } from "../../domain/plan-limits";
import { UpdateBusinessInput } from "../schemas/business.schema";
import { invalidateUserCache } from "../middlewares/auth.middleware";
import { invalidateByBusinessId } from "../../infrastructure/cache/public.cache";

export class BusinessController {
  constructor(
    private readonly businessRepository: IBusinessRepository,
    private readonly barberRepository: IBarberRepository,
    private readonly userRepository: IUserRepository,
    private readonly userBusinessAccess: IUserBusinessAccess,
  ) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");
      res.json({ business });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as UpdateBusinessInput;
      const business = await this.businessRepository.update(req.businessId!, input);
      res.json({ business });
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      const trialActivo = business.trial_ends_at
        ? new Date(business.trial_ends_at) > new Date()
        : false;
      const limits = getPlanLimits(business.plan, trialActivo);
      const totalBarberos = await this.barberRepository.countByBusiness(req.businessId!);

      res.json({
        plan: business.plan,
        trialActivo,
        maxBarberos: limits.maxBarberos,
        totalBarberos,
        excedeLimit: totalBarberos > limits.maxBarberos,
      });
    } catch (error) {
      next(error);
    }
  };

  completeOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.businessRepository.update(req.businessId!, { onboarding_completed: true });
      res.json({ message: "Onboarding completado" });
    } catch (error) {
      next(error);
    }
  };

  switchBusiness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { business_id } = req.body as { business_id: string };

      const hasAccess = await this.userBusinessAccess.hasAccess(userId, business_id);
      if (!hasAccess) throw new AppError("No tenes acceso a ese negocio", 403);

      await this.userRepository.update(userId, { business_id });
      invalidateUserCache(userId);

      res.json({ message: "Negocio activo actualizado" });
    } catch (error) {
      next(error);
    }
  };

  listUserBusinesses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const businesses = await this.userBusinessAccess.findByUser(userId);
      res.json({ businesses });
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const businessId = req.params["id"] as string;

      await this.assertAccess(userId, businessId);
      await this.assertCanDeactivateBusiness(userId, businessId);

      await this.businessRepository.update(businessId, { activo: false });
      invalidateByBusinessId(businessId);

      await this.switchAwayIfCurrent(userId, businessId);

      res.json({ message: "Sucursal desactivada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const businessId = req.params["id"] as string;

      await this.assertAccess(userId, businessId);

      await this.businessRepository.update(businessId, { activo: true });
      invalidateByBusinessId(businessId);

      res.json({ message: "Sucursal reactivada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  deleteBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const businessId = req.params["id"] as string;

      await this.assertAccessAndNotPrincipal(userId, businessId);

      const business = await this.businessRepository.findById(businessId);
      if (!business) throw new NotFoundError("Negocio");
      if (business.activo) {
        throw new AppError("Desactiva la sucursal antes de eliminarla permanentemente", 400);
      }

      await this.businessRepository.delete(businessId);
      invalidateByBusinessId(businessId);

      await this.switchAwayIfCurrent(userId, businessId);

      res.json({ message: "Sucursal eliminada permanentemente" });
    } catch (error) {
      next(error);
    }
  };

  private async assertAccess(userId: string, businessId: string): Promise<void> {
    const hasAccess = await this.userBusinessAccess.hasAccess(userId, businessId);
    if (!hasAccess) throw new AppError("No tenes acceso a ese negocio", 403);
  }

  private async assertAccessAndNotPrincipal(
    userId: string,
    businessId: string,
  ): Promise<void> {
    await this.assertAccess(userId, businessId);

    const principalId = await this.userBusinessAccess.findPrincipalBusinessId(userId);
    if (principalId === businessId) {
      throw new AppError(
        "No podes eliminar el negocio principal desde el panel. Contacta soporte.",
        403,
      );
    }
  }

  private async assertCanDeactivateBusiness(
    userId: string,
    businessId: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    const fallbackBusinessId = await this.findFallbackActiveBusinessId(userId, businessId);

    if (user?.business_id === businessId && !fallbackBusinessId) {
      throw new AppError(
        "Necesitas otra sucursal activa antes de desactivar la actual.",
        400,
      );
    }
  }

  private async switchAwayIfCurrent(
    userId: string,
    inactiveBusinessId: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (user?.business_id !== inactiveBusinessId) return;

    const fallbackBusinessId = await this.findFallbackActiveBusinessId(
      userId,
      inactiveBusinessId,
    );
    if (!fallbackBusinessId) return;

    await this.userRepository.update(userId, { business_id: fallbackBusinessId });
    invalidateUserCache(userId);
  }

  private async findFallbackActiveBusinessId(
    userId: string,
    inactiveBusinessId: string,
  ): Promise<string | null> {
    const businesses = await this.userBusinessAccess.findByUser(userId);
    const fallback = businesses.find(
      (business) => business.id !== inactiveBusinessId && business.activo,
    );
    return fallback?.id ?? null;
  }
}
