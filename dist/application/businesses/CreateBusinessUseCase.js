"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBusinessUseCase = void 0;
const errors_1 = require("../../domain/errors"); // ← dominio, no middleware
const TRIAL_DAYS = 30;
class CreateBusinessUseCase {
    constructor(businessRepository, userRepository) {
        this.businessRepository = businessRepository;
        this.userRepository = userRepository;
    }
    async execute(input) {
        const existing = await this.businessRepository.findBySlug(input.slug);
        if (existing) {
            throw new errors_1.ConflictError(`El slug "${input.slug}" ya está en uso`);
        }
        const trialEndsAt = this.resolveTrialEndsAt(input.trial_ends_at);
        const business = await this.businessRepository.create({
            nombre: input.nombre,
            slug: input.slug,
            email: input.email,
            plan: input.plan ?? "starter",
            trial_ends_at: trialEndsAt,
            tipo_negocio: input.tipo_negocio ?? "general",
            termino_profesional: input.termino_profesional ?? "Profesional",
            termino_profesional_plural: input.termino_profesional_plural ?? "Profesionales",
            termino_servicio: input.termino_servicio ?? "Servicio",
            termino_reserva: input.termino_reserva ?? "Turno",
            logo_url: null,
            color_fondo: "#ffffff",
            color_acento: "#000000",
            color_superficie: "#f5f5f5",
            whatsapp: null,
            direccion: null,
            timezone: "America/Montevideo",
            buffer_minutos: 0,
            auto_confirmar: true,
            activo: true,
            frase_bienvenida: null,
            hero_imagen_url: null,
            instagram: null,
            facebook: null,
            tipografia: "clasica",
            estilo_cards: "minimalista",
            custom_domain: null,
        });
        if (!input.existingUser) {
            await this.userRepository.create({
                id: input.userId,
                business_id: business.id,
                email: input.email,
                nombre: input.nombre_usuario ?? null,
                rol: "owner",
            });
        }
        else {
            await this.userRepository.update(input.userId, {
                business_id: business.id,
            });
        }
        await this.userRepository.addBusinessAccess(input.userId, business.id);
        return business;
    }
    /**
     * Resuelve cuándo vence el trial:
     * - `null` explícito → sin trial (sucursales)
     * - `string` → fecha ya calculada por el caller
     * - `undefined` → calcular: hoy + TRIAL_DAYS
     */
    resolveTrialEndsAt(value) {
        if (value === null)
            return null;
        if (value !== undefined)
            return value;
        const d = new Date();
        d.setDate(d.getDate() + TRIAL_DAYS);
        return d.toISOString();
    }
}
exports.CreateBusinessUseCase = CreateBusinessUseCase;
//# sourceMappingURL=CreateBusinessUseCase.js.map