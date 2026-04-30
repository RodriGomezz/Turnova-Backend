import { SubscriptionPlan } from "../../domain/entities/Subscription";

// ── Resultado de crear un checkout de suscripción en dLocal Go ────────────────
export interface CreateCheckoutResult {
  /** plan_token devuelto por dLocal Go al crear el plan (si se creó ahora) */
  planToken: string;
  /** URL a la que redirigir al usuario para que ingrese su tarjeta */
  subscribeUrl: string;
  /** ID interno del plan en dLocal Go */
  dlocalPlanId: number;
}

// ── Detalle de una ejecución (cobro) de suscripción ──────────────────────────
export interface ExecutionDetails {
  executionId: number;
  orderId: string;
  status: "PENDING" | "COMPLETED" | "DECLINED";
  currency: string;
  amountPaid: number;
}

// ── Detalle de una suscripción ────────────────────────────────────────────────
export interface SubscriptionDetails {
  subscriptionId: number;
  subscriptionToken: string;
  status: "CREATED" | "CONFIRMED";
  active: boolean;
  scheduledDate: string | null;
  clientEmail: string | null;
}

export interface IPaymentProvider {
  /**
   * Obtiene (o crea si no existe) el plan en dLocal Go y devuelve la
   * subscribe_url para redirigir al usuario al checkout hosted.
   */
  getOrCreatePlan(
    plan: SubscriptionPlan,
    notificationUrl: string,
    successUrl: string,
    backUrl: string,
    errorUrl: string,
  ): Promise<CreateCheckoutResult>;

  /**
   * Cancela una suscripción activa en dLocal Go.
   * planId y subscriptionId son los IDs numéricos de dLocal Go.
   */
  cancelSubscription(planId: number, subscriptionId: number): Promise<void>;

  /**
   * Consulta el estado de una suscripción en dLocal Go.
   */
  getSubscription(planId: number, subscriptionId: number): Promise<SubscriptionDetails>;

  /**
   * Consulta una ejecución puntual (cobro) de una suscripción.
   */
  getExecution(
    subscriptionId: number,
    executionId: string,
  ): Promise<ExecutionDetails>;
}
