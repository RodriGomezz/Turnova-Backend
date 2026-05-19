import { SubscriptionPlan } from "../../domain/entities/Subscription";

export interface CreateCheckoutResult {
  planToken: string;
  subscribeUrl: string;
  /** Solo relevante en dLocal Go. En MP siempre es null. */
  dlocalPlanId: number | null;
}

export interface ExecutionDetails {
  executionId: number;
  orderId: string;
  status: "PENDING" | "COMPLETED" | "DECLINED";
  currency: string;
  amountPaid: number;
}

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
   * Obtiene (o crea) el plan/checkout del proveedor y devuelve la URL
   * para redirigir al usuario.
   *
   * @param externalReference - ID interno de la suscripción en nuestra BD.
   *   MercadoPago lo usa como external_reference en el preapproval para
   *   correlacionar los webhooks de pagos con nuestra BD.
   *   dLocal Go lo ignora (usa query param ?external_id= en la subscribeUrl).
   *
   * @param payerEmail - Email del pagador para pre-rellenar el checkout.
   */
  getOrCreatePlan(
    plan: SubscriptionPlan,
    notificationUrl: string,
    successUrl: string,
    backUrl: string,
    errorUrl: string,
    externalReference?: string,
    payerEmail?: string,
  ): Promise<CreateCheckoutResult>;

  cancelSubscription(planId: number, subscriptionId: number): Promise<void>;
  getSubscription(planId: number, subscriptionId: number): Promise<SubscriptionDetails>;
  getExecution(subscriptionId: number, executionId: string): Promise<ExecutionDetails>;
}