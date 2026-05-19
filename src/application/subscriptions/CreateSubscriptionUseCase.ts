import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { SubscriptionPlan } from "../../domain/entities/Subscription";
import { AppError, ConflictError } from "../../domain/errors";
import { logger } from "../../infrastructure/logger";

export interface CreateSubscriptionInput {
  businessId: string;
  plan: SubscriptionPlan;
  email: string;
}

export interface CreateSubscriptionOutput {
  subscribeUrl: string;
  planToken: string;
  subscriptionId: string;
}

export class CreateSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly paymentProvider: IPaymentProvider,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput> {
    const business = await this.businessRepository.findById(input.businessId);
    if (!business) throw new AppError("Negocio no encontrado", 404);

    // Bloquear si ya tiene suscripción activa o en gracia
    const latest = await this.subscriptionRepository.findByBusinessId(input.businessId);
    if (latest && latest.status === "active") {
      throw new ConflictError(
        "Ya tenés una suscripción activa. Cancelala antes de cambiar de plan.",
      );
    }
    if (latest && (latest.status === "past_due" || latest.status === "grace_period")) {
      throw new ConflictError(
        "Tenés un pago pendiente. Esperá a que se resuelva antes de cambiar de plan.",
      );
    }

    // Cancelar cualquier checkout pendiente previo
    const pending = await this.subscriptionRepository.findPendingByBusinessId(input.businessId);
    if (pending) {
      await this.subscriptionRepository.updateStatus(pending.id, "canceled", {
        canceled_at: new Date().toISOString(),
      });
    }

    // ── Construcción de URLs ──────────────────────────────────────────────────
    const apiBase      = process.env.API_URL      ?? "http://localhost:3000";
    const frontendBase = process.env.FRONTEND_URL ?? "http://localhost:5173";

    const notificationUrl = `${apiBase}/api/subscriptions/mercadopago`;
    const successUrl      = `${frontendBase}/panel/configuracion?status=success&tab=planes`;
    const backUrl         = `${frontendBase}/panel/configuracion?status=canceled&tab=planes`;
    const errorUrl        = `${frontendBase}/panel/configuracion?status=error&tab=planes`;

    // Validar y resolver back_url (MP rechaza localhost)
    const resolvedBackUrl = this.resolveSafeBackUrl(backUrl);

    // ── Paso 1: crear registro en BD con estado pending ───────────────────────
    // Se hace ANTES de llamar al proveedor para tener el ID disponible
    // como external_reference en MercadoPago.
    const newSubscription = await this.subscriptionRepository.create({
      business_id:               input.businessId,
      plan:                      input.plan,
      status:                    "pending",
      dlocal_plan_id:            null,
      dlocal_plan_token:         null,
      dlocal_subscription_id:    null,
      dlocal_subscription_token: null,
      dlocal_last_execution_id:  null,
      payer_email:               input.email,
      current_period_start:      null,
      current_period_end:        null,
      grace_period_ends_at:      null,
      canceled_at:               null,
    });

    logger.info("Suscripción pending creada en BD", {
      subscriptionId: newSubscription.id,
      plan:           input.plan,
      businessId:     input.businessId,
    });

    // ── Paso 2: obtener/crear el plan y el checkout en el proveedor ───────────
    let checkoutResult;
    try {
      checkoutResult = await this.paymentProvider.getOrCreatePlan(
        input.plan,
        notificationUrl,
        successUrl,
        resolvedBackUrl,
        errorUrl,
        newSubscription.id,   // ← externalReference: nuestro ID interno
        input.email,
      );
    } catch (err) {
      // Si el proveedor falla, cancelar el pending para no dejar registros huérfanos
      await this.subscriptionRepository.updateStatus(newSubscription.id, "canceled", {
        canceled_at: new Date().toISOString(),
      }).catch((rollbackErr) =>
        logger.error("Error en rollback de suscripción pending", { rollbackErr }),
      );
      throw err;
    }

    // ── Paso 3: actualizar BD con los IDs del proveedor ───────────────────────
    await this.subscriptionRepository.updateStatus(newSubscription.id, "pending", {
      dlocal_plan_id:    checkoutResult.dlocalPlanId ?? null,
      dlocal_plan_token: checkoutResult.planToken,
    });

    return {
      subscribeUrl:   checkoutResult.subscribeUrl,
      planToken:      checkoutResult.planToken,
      subscriptionId: newSubscription.id,
    };
  }

  /**
   * MercadoPago rechaza back_url con localhost.
   * En desarrollo usar MP_DEV_BACK_URL (ej: URL de ngrok).
   * En producción FRONTEND_URL siempre debe ser https:// con dominio real.
   */
  private resolveSafeBackUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const isLocal =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname.endsWith(".localhost");

      if (isLocal) {
        const devFallback = process.env.MP_DEV_BACK_URL;
        if (devFallback) {
          logger.info("MP: usando MP_DEV_BACK_URL como back_url (entorno local)", {
            devFallback,
          });
          return devFallback;
        }
        throw new AppError(
          "MercadoPago rechaza back_url con localhost. " +
          "Configurá MP_DEV_BACK_URL con una URL pública (ej: ngrok) en tu .env.",
          400,
        );
      }
      return url;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`back_url inválida para MercadoPago: "${url}"`, 400);
    }
  }
}