import { Request, Response, NextFunction } from "express";
import { supabase } from "../../infrastructure/database/supabase.client";
import { CreateBusinessUseCase } from "../../application/businesses/CreateBusinessUseCase";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import { UserRepository } from "../../infrastructure/database/UserRepository";
import { RegisterInput, LoginInput } from "../schemas/auth.schema";
import {
  AppError,
  NotFoundError,
} from "../middlewares/errorHandler.middleware";
import { invalidateUserCache } from "../middlewares/auth.middleware";
import { logger } from "../../infrastructure/logger";

export class AuthController {
  private readonly createBusinessUseCase: CreateBusinessUseCase;
  private readonly userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.createBusinessUseCase = new CreateBusinessUseCase(
      new BusinessRepository(),
      this.userRepository,
    );
  }

  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const {
        nombre,
        email,
        password,
        nombre_negocio,
        slug,
        tipo_negocio,
        termino_profesional,
        termino_profesional_plural,
        termino_servicio,
        termino_reserva,
      } = req.body as RegisterInput;

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) throw new AppError(authError.message, 400);
      if (!authData.user) throw new AppError("Error al crear usuario", 500);

      try {
        const business = await this.createBusinessUseCase.execute({
          nombre: nombre_negocio,
          slug,
          userId: authData.user.id,
          nombre_usuario: nombre,
          email,
          tipo_negocio,
          termino_profesional,
          termino_profesional_plural,
          termino_servicio,
          termino_reserva,
        });

        res.status(201).json({
          message: "Cuenta creada exitosamente",
          business: {
            id: business.id,
            slug: business.slug,
            nombre: business.nombre,
          },
        });
      } catch (businessError) {
        logger.error("Error en createBusinessUseCase", {
          message:
            businessError instanceof Error
              ? businessError.message
              : businessError,
          stack:
            businessError instanceof Error ? businessError.stack : undefined,
        });
        await supabase.auth.admin
          .deleteUser(authData.user.id)
          .catch((err) => logger.error("Error en rollback", { err }));
        throw businessError;
      }
    } catch (error) {
      next(error);
    }
  };

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body as LoginInput;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new AppError("Credenciales inválidas", 401);

      res.json({
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await this.userRepository.findById(req.userId!);
      if (!user) throw new NotFoundError("Usuario");

      const businesses = await this.userRepository.findBusinessesByUserId(
        req.userId!,
      );

      res.json({ user, businesses });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) throw new AppError("Refresh token requerido", 400);

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      });
      if (error || !data.session) throw new AppError("Sesión inválida", 401);

      res.json({
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;
      const { nombre, password } = req.body;

      if (!nombre?.trim()) throw new AppError("El nombre es requerido", 400);

      if (password) {
        if (password.length < 8) {
          throw new AppError(
            "La contraseña debe tener al menos 8 caracteres",
            400,
          );
        }
        const { error: passError } = await supabase.auth.admin.updateUserById(
          userId,
          { password },
        );
        if (passError) throw new AppError(passError.message, 500);
      }

      await this.userRepository.update(userId, { nombre: nombre.trim() });

      // Invalidar cache para que el próximo request cargue datos frescos
      invalidateUserCache(userId);

      res.json({ message: "Perfil actualizado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  requestPasswordReset = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email } = req.body as { email: string };

      if (!email) throw new AppError("El email es requerido", 400);

      // Supabase envía el email automáticamente
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
      });

      // Siempre responder igual — no revelar si el email existe
      if (error)
        logger.warn("Error en resetPasswordForEmail", { error: error.message });

      res.json({
        message:
          "Si el email existe, recibirás un link para restablecer tu contraseña.",
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { access_token, password } = req.body as {
        access_token: string;
        password: string;
      };

      if (!access_token) throw new AppError("Token requerido", 400);
      if (!password || password.length < 8) {
        throw new AppError(
          "La contraseña debe tener al menos 8 caracteres",
          400,
        );
      }

      // Verificar el token y actualizar la contraseña
      const {
        data: { user },
        error: verifyError,
      } = await supabase.auth.getUser(access_token);
      if (verifyError || !user)
        throw new AppError("Token inválido o expirado", 401);

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password },
      );

      if (updateError)
        throw new AppError("Error al actualizar la contraseña", 500);

      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      next(error);
    }
  };

  createBranch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId!;

      const user = await this.userRepository.findById(userId);
      if (!user) throw new NotFoundError("Usuario");

      // Buscar el negocio con plan Business entre todos los del usuario
      const { data: userBusinesses, error } = await supabase
        .from("user_businesses")
        .select(
          "businesses(id, plan, trial_ends_at, email, tipo_negocio, termino_profesional, termino_profesional_plural, termino_servicio, termino_reserva)",
        )
        .eq("user_id", userId);

      if (error) throw new AppError("Error al verificar plan", 500);

      const businessBusiness = (userBusinesses ?? [])
        .map((row: any) => row.businesses)
        .find((b: any) => b?.plan === "business");

      if (!businessBusiness) {
        throw new AppError("Las sucursales requieren el plan Business", 403);
      }

      const { nombre, slug } = req.body as { nombre: string; slug: string };
      if (!nombre?.trim()) throw new AppError("El nombre es requerido", 400);
      if (!slug?.trim()) throw new AppError("El slug es requerido", 400);

      const branch = await this.createBusinessUseCase.execute({
        nombre,
        slug,
        userId,
        nombre_usuario: user.nombre ?? undefined,
        email: businessBusiness.email ?? "",
        tipo_negocio: businessBusiness.tipo_negocio,
        termino_profesional: businessBusiness.termino_profesional,
        termino_profesional_plural: businessBusiness.termino_profesional_plural,
        termino_servicio: businessBusiness.termino_servicio,
        termino_reserva: businessBusiness.termino_reserva,
        existingUser: true,
        // Heredar plan Business y sin trial
        plan: "business",
        trial_ends_at: null,
      });

      res.status(201).json({
        message: "Sucursal creada correctamente",
        business: { id: branch.id, slug: branch.slug, nombre: branch.nombre },
      });
    } catch (error) {
      next(error);
    }
  };
}
