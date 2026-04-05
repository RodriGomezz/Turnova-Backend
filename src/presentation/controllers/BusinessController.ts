import { Request, Response, NextFunction } from "express";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import { BarberRepository } from "../../infrastructure/database/BarberRepository";
import { UserRepository } from "../../infrastructure/database/UserRepository";
import { supabase } from "../../infrastructure/database/supabase.client";
import {
  AppError,
  NotFoundError,
} from "../middlewares/errorHandler.middleware";
import { getPlanLimits } from "../../domain/plan-limits";
import { UpdateBusinessInput } from "../schemas/business.schema";
import { invalidateUserCache } from "../middlewares/auth.middleware";
import { invalidateByBusinessId } from "../../infrastructure/cache/public.cache";

export class BusinessController {
  private readonly businessRepository: BusinessRepository;
  private readonly barberRepository: BarberRepository;
  private readonly userRepository: UserRepository;

  constructor() {
    this.businessRepository = new BusinessRepository();
    this.barberRepository = new BarberRepository();
    this.userRepository = new UserRepository();
  }

  get = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new AppError("Negocio no encontrado", 404);
      res.json({ business });
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
      const input = req.body as UpdateBusinessInput;
      const business = await this.businessRepository.update(
        req.businessId!,
        input,
      );
      res.json({ business });
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new AppError("Negocio no encontrado", 404);

      const trialActivo = business.trial_ends_at
        ? new Date(business.trial_ends_at) > new Date()
        : false;
      const limits = getPlanLimits(business.plan, trialActivo);
      const totalBarberos = await this.barberRepository.countByBusiness(
        req.businessId!,
      );
      const excedeLimit = totalBarberos > limits.maxBarberos;

      res.json({
        plan: business.plan,
        trialActivo,
        maxBarberos: limits.maxBarberos,
        totalBarberos,
        excedeLimit,
      });
    } catch (error) {
      next(error);
    }
  };

  completeOnboarding = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.businessRepository.update(req.businessId!, {
        onboarding_completed: true,
      });
      res.json({ message: "Onboarding completado" });
    } catch (error) {
      next(error);
    }
  };

  switchBusiness = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;
      const { business_id } = req.body as { business_id: string };

      const { data, error } = await supabase
        .from("user_businesses")
        .select("id")
        .eq("user_id", userId)
        .eq("business_id", business_id)
        .single();

      if (error || !data)
        throw new AppError("No tenés acceso a ese negocio", 403);

      await this.userRepository.update(userId, { business_id });
      invalidateUserCache(userId);

      res.json({ message: "Negocio activo actualizado" });
    } catch (error) {
      next(error);
    }
  };

  // ── Desactivar negocio / sucursal ──────────────────────────────────────────
  deactivate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;
      const businessId = req.params["id"] as string;

      // Verificar que el usuario tiene acceso a ese negocio
      const { data: access, error: accessError } = await supabase
        .from("user_businesses")
        .select("id")
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .single();

      if (accessError || !access)
        throw new AppError("No tenés acceso a ese negocio", 403);

      // Proteger el negocio principal (el primero que se creó — menor created_at)
      const { data: businesses } = await supabase
        .from("user_businesses")
        .select("business_id, businesses(created_at)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const principal = (businesses ?? [])[0] as any;
      if (principal?.business_id === businessId) {
        throw new AppError(
          "No podés desactivar el negocio principal desde el panel. Contactá soporte.",
          403,
        );
      }

      await this.businessRepository.update(businessId, { activo: false });
      invalidateByBusinessId(businessId);

      // Si el negocio desactivado es el activo, cambiar al principal
      const user = await this.userRepository.findById(userId);
      if (user?.business_id === businessId && principal?.business_id) {
        await this.userRepository.update(userId, {
          business_id: principal.business_id,
        });
        invalidateUserCache(userId);
      }

      res.json({ message: "Sucursal desactivada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── Reactivar sucursal ────────────────────────────────────────────────────
  reactivate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;
      const businessId = req.params["id"] as string;

      const { data: access, error: accessError } = await supabase
        .from("user_businesses")
        .select("id")
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .single();

      if (accessError || !access)
        throw new AppError("No tenés acceso a ese negocio", 403);

      await this.businessRepository.update(businessId, { activo: true });
      invalidateByBusinessId(businessId);

      res.json({ message: "Sucursal reactivada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  // ── Eliminar permanentemente sucursal ─────────────────────────────────────
  deleteBranch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;
      const businessId = req.params["id"] as string;

      // Verificar acceso
      const { data: access, error: accessError } = await supabase
        .from("user_businesses")
        .select("id")
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .single();

      if (accessError || !access)
        throw new AppError("No tenés acceso a ese negocio", 403);

      // Proteger negocio principal
      const { data: businesses } = await supabase
        .from("user_businesses")
        .select("business_id, businesses(created_at)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const principal = (businesses ?? [])[0] as any;
      if (principal?.business_id === businessId) {
        throw new AppError(
          "No podés eliminar el negocio principal. Contactá soporte.",
          403,
        );
      }

      // Confirmar que está desactivado antes de eliminar
      const business = await this.businessRepository.findById(businessId);
      if (!business) throw new NotFoundError("Negocio");
      if (business.activo) {
        throw new AppError(
          "Desactivá la sucursal antes de eliminarla permanentemente",
          400,
        );
      }

      // Eliminar en cascada — el FK ON DELETE CASCADE en la BD se encarga del resto
      const { error: deleteError } = await supabase
        .from("businesses")
        .delete()
        .eq("id", businessId);

      if (deleteError) throw new AppError(deleteError.message, 500);

      invalidateByBusinessId(businessId);

      // Si era el negocio activo, cambiar al principal
      const user = await this.userRepository.findById(userId);
      if (user?.business_id === businessId && principal?.business_id) {
        await this.userRepository.update(userId, {
          business_id: principal.business_id,
        });
        invalidateUserCache(userId);
      }

      res.json({ message: "Sucursal eliminada permanentemente" });
    } catch (error) {
      next(error);
    }
  };

  // ── Listar negocios del usuario ────────────────────────────────────────────
  listUserBusinesses = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;

      const { data, error } = await supabase
        .from("user_businesses")
        .select(
          "business_id, businesses(id, nombre, slug, logo_url, activo, plan, created_at)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw new AppError(error.message, 500);

      const businesses = (data ?? [])
        .map((row: any) => row.businesses)
        .filter(Boolean);

      // El primero (más antiguo) es el principal
      const result = businesses.map((b: any, index: number) => ({
        ...b,
        esPrincipal: index === 0,
      }));

      res.json({ businesses: result });
    } catch (error) {
      next(error);
    }
  };
 getSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from("business_subscription")       // view, no tabla directa
      .select(
        "plan, status, current_period_end, grace_period_ends_at, dlocal_subscription_id",
      )
      .eq("business_id", req.businessId!)
      .maybeSingle();                       // null si no existe — no lanza error

    if (error) throw new AppError(error.message, 500);

    if (!data) {
      // Sin suscripción registrada — el frontend lo maneja como null
      res.json({ subscription: null });
      return;
    }

    // Mapear status de la BD al modelo del frontend
    // La view puede tener: active | past_due | grace_period | canceled | expired
    res.json({
      subscription: {
        plan:                  data.plan,
        status:                data.status,
        current_period_end:    data.current_period_end    ?? null,
        grace_period_ends_at:  data.grace_period_ends_at  ?? null,
        dlocal_subscription_id: data.dlocal_subscription_id ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};
}
