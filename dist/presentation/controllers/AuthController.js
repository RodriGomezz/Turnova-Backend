"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const supabase_client_1 = require("../../infrastructure/database/supabase.client");
const CreateBusinessUseCase_1 = require("../../application/businesses/CreateBusinessUseCase");
const BusinessRepository_1 = require("../../infrastructure/database/BusinessRepository");
const UserRepository_1 = require("../../infrastructure/database/UserRepository");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const logger_1 = require("../../infrastructure/logger");
class AuthController {
    constructor() {
        this.register = async (req, res, next) => {
            try {
                const { nombre, email, password, nombre_negocio, slug, tipo_negocio, termino_profesional, termino_profesional_plural, termino_servicio, termino_reserva, } = req.body;
                // Crear usuario en Supabase Auth
                const { data: authData, error: authError } = await supabase_client_1.supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                });
                if (authError)
                    throw new errorHandler_middleware_1.AppError(authError.message, 400);
                if (!authData.user)
                    throw new errorHandler_middleware_1.AppError("Error al crear usuario", 500);
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
                }
                catch (businessError) {
                    logger_1.logger.error("Error en createBusinessUseCase", {
                        message: businessError instanceof Error
                            ? businessError.message
                            : businessError,
                        stack: businessError instanceof Error ? businessError.stack : undefined,
                    });
                    await supabase_client_1.supabase.auth.admin
                        .deleteUser(authData.user.id)
                        .catch((err) => logger_1.logger.error("Error en rollback", { err }));
                    throw businessError;
                }
            }
            catch (error) {
                next(error);
            }
        };
        this.login = async (req, res, next) => {
            try {
                const { email, password } = req.body;
                const { data, error } = await supabase_client_1.supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error)
                    throw new errorHandler_middleware_1.AppError("Credenciales inválidas", 401);
                res.json({
                    token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                    user: {
                        id: data.user.id,
                        email: data.user.email,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.me = async (req, res, next) => {
            try {
                const user = await this.userRepository.findById(req.userId);
                if (!user)
                    throw new errorHandler_middleware_1.NotFoundError("Usuario");
                const businesses = await this.userRepository.findBusinessesByUserId(req.userId);
                res.json({ user, businesses });
            }
            catch (error) {
                next(error);
            }
        };
        this.refresh = async (req, res, next) => {
            try {
                const { refresh_token } = req.body;
                if (!refresh_token)
                    throw new errorHandler_middleware_1.AppError("Refresh token requerido", 400);
                const { data, error } = await supabase_client_1.supabase.auth.refreshSession({
                    refresh_token,
                });
                if (error || !data.session)
                    throw new errorHandler_middleware_1.AppError("Sesión inválida", 401);
                res.json({
                    token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateProfile = async (req, res, next) => {
            try {
                const userId = req.userId;
                const { nombre, password } = req.body;
                if (!nombre?.trim())
                    throw new errorHandler_middleware_1.AppError("El nombre es requerido", 400);
                if (password) {
                    if (password.length < 8) {
                        throw new errorHandler_middleware_1.AppError("La contraseña debe tener al menos 8 caracteres", 400);
                    }
                    const { error: passError } = await supabase_client_1.supabase.auth.admin.updateUserById(userId, { password });
                    if (passError)
                        throw new errorHandler_middleware_1.AppError(passError.message, 500);
                }
                await this.userRepository.update(userId, { nombre: nombre.trim() });
                // Invalidar cache para que el próximo request cargue datos frescos
                (0, auth_middleware_1.invalidateUserCache)(userId);
                res.json({ message: "Perfil actualizado correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        this.requestPasswordReset = async (req, res, next) => {
            try {
                const { email } = req.body;
                if (!email)
                    throw new errorHandler_middleware_1.AppError("El email es requerido", 400);
                // Supabase envía el email automáticamente
                const { error } = await supabase_client_1.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
                });
                // Siempre responder igual — no revelar si el email existe
                if (error)
                    logger_1.logger.warn("Error en resetPasswordForEmail", { error: error.message });
                res.json({
                    message: "Si el email existe, recibirás un link para restablecer tu contraseña.",
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.resetPassword = async (req, res, next) => {
            try {
                const { access_token, password } = req.body;
                if (!access_token)
                    throw new errorHandler_middleware_1.AppError("Token requerido", 400);
                if (!password || password.length < 8) {
                    throw new errorHandler_middleware_1.AppError("La contraseña debe tener al menos 8 caracteres", 400);
                }
                // Verificar el token y actualizar la contraseña
                const { data: { user }, error: verifyError, } = await supabase_client_1.supabase.auth.getUser(access_token);
                if (verifyError || !user)
                    throw new errorHandler_middleware_1.AppError("Token inválido o expirado", 401);
                const { error: updateError } = await supabase_client_1.supabase.auth.admin.updateUserById(user.id, { password });
                if (updateError)
                    throw new errorHandler_middleware_1.AppError("Error al actualizar la contraseña", 500);
                res.json({ message: "Contraseña actualizada correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        this.createBranch = async (req, res, next) => {
            try {
                const userId = req.userId;
                const user = await this.userRepository.findById(userId);
                if (!user)
                    throw new errorHandler_middleware_1.NotFoundError("Usuario");
                // Buscar el negocio con plan Business entre todos los del usuario
                const { data: userBusinesses, error } = await supabase_client_1.supabase
                    .from("user_businesses")
                    .select("businesses(id, plan, trial_ends_at, email, tipo_negocio, termino_profesional, termino_profesional_plural, termino_servicio, termino_reserva)")
                    .eq("user_id", userId);
                if (error)
                    throw new errorHandler_middleware_1.AppError("Error al verificar plan", 500);
                const businessBusiness = (userBusinesses ?? [])
                    .map((row) => row.businesses)
                    .find((b) => b?.plan === "business");
                if (!businessBusiness) {
                    throw new errorHandler_middleware_1.AppError("Las sucursales requieren el plan Business", 403);
                }
                const { nombre, slug } = req.body;
                if (!nombre?.trim())
                    throw new errorHandler_middleware_1.AppError("El nombre es requerido", 400);
                if (!slug?.trim())
                    throw new errorHandler_middleware_1.AppError("El slug es requerido", 400);
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
            }
            catch (error) {
                next(error);
            }
        };
        this.userRepository = new UserRepository_1.UserRepository();
        this.createBusinessUseCase = new CreateBusinessUseCase_1.CreateBusinessUseCase(new BusinessRepository_1.BusinessRepository(), this.userRepository);
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=AuthController.js.map