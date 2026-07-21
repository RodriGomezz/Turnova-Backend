import { Request, Response, NextFunction } from "express";
import {
  createSupabaseAuthClient,
  supabase,
} from "../../infrastructure/database/supabase.client";
import { CreateBusinessUseCase } from "../../application/businesses/CreateBusinessUseCase";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import { UserRepository } from "../../infrastructure/database/UserRepository";
import { RegisterInput, LoginInput, ResendConfirmationInput } from "../schemas/auth.schema";
import {
  AppError,
  NotFoundError,
} from "../middlewares/errorHandler.middleware";
import { invalidateUserCache } from "../middlewares/auth.middleware";
import { logger } from "../../infrastructure/logger";

type RefreshCookieSameSite = "lax" | "strict" | "none";

const isProduction = process.env.NODE_ENV === "production";
const refreshCookieSameSite = (
  process.env.REFRESH_COOKIE_SAMESITE?.toLowerCase() as RefreshCookieSameSite | undefined
) ?? (isProduction ? "none" : "lax");

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction || refreshCookieSameSite === "none",
  sameSite: refreshCookieSameSite,
  path: "/api/auth/refresh",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getAuthRedirectUrl(path: string): string {
  const rawBaseUrl = (
    process.env.AUTH_EMAIL_REDIRECT_URL ??
    process.env.FRONTEND_URL ??
    "http://localhost:4200"
  ).trim();

  const withProtocol = /^https?:\/\//i.test(rawBaseUrl)
    ? rawBaseUrl
    : `https://${rawBaseUrl}`;

  const baseUrl = withProtocol.replace(/\/+$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

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

      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: {
            nombre,
            nombre_negocio,
            slug,
          },
        });

      if (authError) {
        // Supabase devuelve "User already registered" o "Email already in use"
        // para emails duplicados. Detectarlo y dar un mensaje claro para que
        // el usuario vaya a login en lugar de reintentar el registro.
        const msg = authError.message.toLowerCase();
        if (
          msg.includes("already registered") ||
          msg.includes("already in use") ||
          msg.includes("already exists") ||
          authError.code === "email_exists"
        ) {
          throw new AppError(
            "Este email ya tiene una cuenta. Iniciá sesión o usá otro email.",
            409,
          );
        }
        throw new AppError(authError.message, 400);
      }
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

        // Enviar email de confirmación — admin.createUser no lo dispara automáticamente
        const authClient = createSupabaseAuthClient();
        const { error: confirmationError } = await authClient.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/login?email_confirmed=1"),
          },
        });

        if (confirmationError) {
          logger.warn("No se pudo enviar email de confirmación tras el registro", {
            error: confirmationError.message,
          });
        }

        res.status(201).json({
          message: "Cuenta creada. Revisá tu email para confirmar la cuenta antes de ingresar.",
          email,
          requires_email_confirmation: true,
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
      const authClient = createSupabaseAuthClient();

      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          throw new AppError(
            "Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.",
            403,
          );
        }
        throw new AppError("Credenciales inválidas", 401);
      }

      if (!data.user?.email_confirmed_at) {
        res.clearCookie("refresh_token", {
          path: REFRESH_COOKIE_OPTIONS.path,
          secure: REFRESH_COOKIE_OPTIONS.secure,
          sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
        });

        throw new AppError(
          "Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.",
          403,
        );
      }

      // Registrar último acceso en login — un write puntual es suficiente.
      // Fire-and-forget: no bloquea la respuesta ni falla el login si la BD tarda.
      this.userRepository
        .updateLastSeen(data.user!.id, new Date().toISOString())
        .catch((err) => logger.error("Error actualizando last_seen_at en login", { err }));

      res.cookie("refresh_token", data.session.refresh_token, REFRESH_COOKIE_OPTIONS);

      res.json({
        token: data.session.access_token,
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

      let resolvedUser = user;
      const currentBusiness = businesses.find(
        (business) => business.id === user.business_id,
      );

      if (currentBusiness && !currentBusiness.activo) {
        const fallbackBusiness = businesses.find((business) => business.activo);
        if (fallbackBusiness) {
          resolvedUser = await this.userRepository.update(user.id, {
            business_id: fallbackBusiness.id,
          });
          invalidateUserCache(user.id);
        } else {
          invalidateUserCache(user.id);
          throw new AppError(
            "No tenés negocios activos disponibles. Revisá tu plan o contactá soporte.",
            403,
          );
        }
      }

      res.json({ user: resolvedUser, businesses });
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
      const refresh_token = getCookie(req, "refresh_token");
      if (!refresh_token) throw new AppError("Refresh token requerido", 401);
      const authClient = createSupabaseAuthClient();

      const { data, error } = await authClient.auth.refreshSession({
        refresh_token,
      });

      if (error || !data.session) {
        const msg = error?.message?.toLowerCase() ?? "";
        const isTimeout = msg.includes("aborted") || msg.includes("abort");
        const isExpired =
          !isTimeout && (
            msg.includes("expired") ||
            msg.includes("invalid refresh token") ||
            msg.includes("already used") ||
            msg.includes("not found")
          );

        if (isTimeout) {
          // Supabase tardó más de 8s — decirle al frontend que reintente en 3s
          res.set("Retry-After", "3");
          throw new AppError("Servicio temporalmente no disponible. Reintentá en unos segundos.", 503);
        }

        throw new AppError(
          isExpired ? "Sesión expirada. Iniciá sesión nuevamente." : "Error al renovar sesión.",
          isExpired ? 401 : 503,
        );
      }

      // Registrar acceso también en refresh: el usuario mantiene la sesión
      // sin hacer login explícito, pero sigue siendo un acceso real al panel.
      // data.session.user.id está garantizado — ya verificamos !data.session arriba.
      this.userRepository
        .updateLastSeen(data.session.user.id, new Date().toISOString())
        .catch((err) => logger.error("Error actualizando last_seen_at en refresh", { err }));

      res.cookie("refresh_token", data.session.refresh_token, REFRESH_COOKIE_OPTIONS);

      res.json({
        token: data.session.access_token,
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
      const authClient = createSupabaseAuthClient();
      const { error } = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
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

  resendConfirmation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email } = req.body as ResendConfirmationInput;
      const authClient = createSupabaseAuthClient();

      const { error } = await authClient.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl("/login?email_confirmed=1"),
        },
      });

      if (error) {
        logger.warn("Error reenviando confirmación de email", {
          error: error.message,
        });
      }

      res.json({
        message:
          "Si la cuenta existe y todavía no fue confirmada, vas a recibir un nuevo email de confirmación.",
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
      const { access_token, refresh_token, password } = req.body as {
        access_token: string;
        refresh_token?: string;
        password: string;
      };
      const authClient = createSupabaseAuthClient();

      if (!access_token) throw new AppError("Token requerido", 400);
      if (!refresh_token) throw new AppError("Refresh token de recuperación requerido", 400);
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
      } = await authClient.auth.getUser(access_token);
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

      await this.userRepository.update(userId, { business_id: branch.id });
      invalidateUserCache(userId);

      res.status(201).json({
        message: "Sucursal creada correctamente",
        business: { id: branch.id, slug: branch.slug, nombre: branch.nombre },
      });
    } catch (error) {
      next(error);
    }
  };
}
