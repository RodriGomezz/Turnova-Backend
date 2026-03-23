import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import { UserRepository } from "../../infrastructure/database/UserRepository";
import { Business, BusinessPlan } from "../../domain/entities/Business";
import { ConflictError } from "../../presentation/middlewares/errorHandler.middleware";

const TRIAL_DAYS = 30;

interface CreateBusinessInput {
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
  // Si es true, no intenta crear el usuario — solo vincula el negocio
  existingUser?: boolean;
  plan?: BusinessPlan; 
  trial_ends_at?: string | null; 
}

export class CreateBusinessUseCase {
  constructor(
    private readonly businessRepository: BusinessRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: CreateBusinessInput): Promise<Business> {
    const existing = await this.businessRepository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`El slug "${input.slug}" ya está en uso`);
    }

  const trialEndsAt =
    input.trial_ends_at !== undefined
      ? input.trial_ends_at // usar el valor pasado (null para sucursales)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + TRIAL_DAYS);
          return d.toISOString();
        })();

  const business = await this.businessRepository.create({
    nombre: input.nombre,
    slug: input.slug,
    email: input.email,
    plan: input.plan ?? "starter", // ← heredar plan
    trial_ends_at: trialEndsAt,
    tipo_negocio: input.tipo_negocio ?? "general",
    termino_profesional: input.termino_profesional ?? "Profesional",
    termino_profesional_plural:
      input.termino_profesional_plural ?? "Profesionales",
    termino_servicio: input.termino_servicio ?? "Servicio",
    termino_reserva: input.termino_reserva ?? "Turno",
  });

    if (!input.existingUser) {
      // Registro nuevo — crear usuario
      await this.userRepository.create({
        id: input.userId,
        business_id: business.id,
        email: input.email,
        nombre: input.nombre_usuario ?? null,
        rol: "owner",
      });
    } else {
      // Sucursal — el usuario ya existe, solo actualizar su business_id activo
      await this.userRepository.update(input.userId, {
        business_id: business.id,
      });
    }

    // Vincular usuario con el nuevo negocio en user_businesses
    await this.userRepository.addBusinessAccess(input.userId, business.id);

    return business;
  }
}
