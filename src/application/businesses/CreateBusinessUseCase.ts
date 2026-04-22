import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { Business, BusinessPlan } from "../../domain/entities/Business";
import { ConflictError } from "../../domain/errors";
import { vercelService } from "../../infrastructure/services/vercel.service";
const TRIAL_DAYS = 30;

export interface CreateBusinessInput {
  nombre: string;
  slug: string;
  userId: string;
  email: string;
  nombre_usuario?: string;
  tipo_negocio?: string;
  termino_profesional?: string;
  termino_profesional_plural?: string;
  termino_servicio?: string;
  termino_reserva?: string;
  existingUser?: boolean;
  plan?: BusinessPlan;
  trial_ends_at?: string | null;
}

export class CreateBusinessUseCase {
  constructor(
    private readonly businessRepository: IBusinessRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: CreateBusinessInput): Promise<Business> {
    const existing = await this.businessRepository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`El slug "${input.slug}" ya está en uso`);
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
    } else {
      await this.userRepository.update(input.userId, {
        business_id: business.id,
      });
    }

    await this.userRepository.addBusinessAccess(input.userId, business.id);

    // Registrar dominios en Vercel en background — no bloquea ni rompe el flujo
    vercelService.provisionDomains(business.slug).catch(() => {});

    return business;
  }

  private resolveTrialEndsAt(value: string | null | undefined): string | null {
    if (value === null) return null;
    if (value !== undefined) return value;
    const d = new Date();
    d.setDate(d.getDate() + TRIAL_DAYS);
    return d.toISOString();
  }
}