import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { Business, BusinessPlan } from "../../domain/entities/Business";
import { ConflictError } from "../../domain/errors";
import { vercelService } from "../../infrastructure/services/vercel.service";
import { TRIAL_DAYS } from "../../domain/plan-prices";
import { registerSlug } from "../../infrastructure/cache/slug.cache";
import { logger } from "../../infrastructure/logger";

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
    private readonly serviceRepository: IServiceRepository,
  ) {}

  async execute(input: CreateBusinessInput): Promise<Business> {
    const existing = await this.businessRepository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`El slug "${input.slug}" ya está en uso`);
    }

    const trialEndsAt = this.resolveTrialEndsAt(input.trial_ends_at);

    // Registrar slug en caché antes de la BD para que slug-check lo refleje inmediatamente
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
      estilo_cards: "destacado",
      horario_texto: null,
      fotos_galeria: [],
      faq_items: [],
      custom_domain: null,
      dias_anticipacion: 7,
      recordatorio_horas_antes: 24,
      ciudad: null,
      pais: null,
    });

    try {
      // Marcar el slug como ocupado en el cache en memoria
    registerSlug(business.slug);

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
    } catch (error) {
      logger.error("Error al crear usuario/acceso — haciendo rollback del negocio", {
        businessId: business.id,
        slug: business.slug,
        userId: input.userId,
        error: error instanceof Error ? error.message : error,
      });
      await this.businessRepository.delete(business.id).catch((rbErr) =>
        logger.error("Error en rollback del negocio", { businessId: business.id, error: rbErr }),
      );
      throw error;
    }

    // Servicio genérico ("Otros / Varios") para booking_items sin catálogo
    // (productos, adicionales ad-hoc cobrados en el momento). No bloquea el
    // alta del negocio si falla: un negocio sin este servicio todavía puede
    // operar con servicios de catálogo normales, y el backfill de la
    // migración de multi-servicio crea el faltante para cualquier negocio
    // que no lo tenga antes de que la feature salga a producción.
    await this.serviceRepository
      .create({
        business_id: business.id,
        nombre: "Otros / Varios",
        descripcion: null,
        incluye: null,
        // duracion_minutos = 1, no 0: la tabla services tiene un CHECK
        // constraint (services_duracion_check: duracion_minutos > 0).
        // Es decorativo — ver nota en la migración 009 de backfill.
        duracion_minutos: 1,
        precio: 0,
        precio_hasta: null,
        // Servicio genérico: nunca tiene fases de procesamiento, es
        // decorativo igual que duracion_minutos = 1.
        tiempo_activo_inicial_minutos: 1,
        tiempo_procesamiento_minutos: 0,
        // Irrelevante: este servicio nunca se muestra en una lista
        // ordenada (se filtra por es_generico en findAllByBusiness y en
        // el frontend), así que no necesita el cálculo de getNextOrden.
        orden: 0,
        es_generico: true,
      })
      .catch((error) => {
        logger.error("No se pudo crear el servicio genérico del negocio — se creará por backfill", {
          businessId: business.id,
          error: error instanceof Error ? error.message : error,
        });
      });

    logger.info("Negocio creado", {
      businessId: business.id,
      slug:       business.slug,
      userId:     input.userId,
      plan:       business.plan,
    });

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
