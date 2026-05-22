import { SubscriptionPlan, BillingCycle } from "../../domain/entities/Subscription";

// ── Resultado de crear un checkout de suscripción en dLocal Go ────────────────
export interface CreateCheckoutResult {
  /** plan_token devuelto por dLocal Go al crear el plan */
  planToken: string;
  /** URL a la que redirigir al usuario para que ingrese su tarjeta */
  subscribeUrl: string;
  /** ID interno del plan en dLocal Go */
  dlocalPlanId: number;
}

// ── Detalle de una ejecución (cobro) de suscripción ──────────────────────────
export interface ExecutionDetails {
  executionId:       number;
  orderId:           string;
  status:            "PENDING" | "COMPLETED" | "DECLINED";
  currency:          string;
  amountPaid:        number;
  subscriptionToken: string | null;
  planToken:         string | null;
}

// ── Detalle de una suscripción ────────────────────────────────────────────────
export interface SubscriptionDetails {
  subscriptionId:    number;
  subscriptionToken: string;
  status:            "CREATED" | "CONFIRMED";
  active:            boolean;
  scheduledDate:     string | null;
  clientEmail:       string | null;
}

// ── Detalle de un pago individual (endpoint GET /v1/payments/:id) ─────────────
// dLocal Go envía solo { "payment_id": "..." } en el webhook; este objeto
// representa la respuesta completa al consultar ese payment_id.
export interface PaymentDetails {
  id:                string;
  status:            "PENDING" | "COMPLETED" | "DECLINED" | "CANCELLED" | string;
  /** order_id del checkout — equivale al execution order_id en suscripciones */
  orderId:           string | null;
  /** subscription_token, si el pago pertenece a una suscripción */
  subscriptionToken: string | null;
  /** plan_token del plan asociado */
  planToken:         string | null;
  /** external_id enviado al crear el checkout (nuestro subscriptionId interno) */
  externalId:        string | null;
  currency:          string | null;
  amount:            number | null;
  clientEmail:       string | null;
}

export interface IPaymentProvider {
  /**
   * Obtiene (o crea si no existe) el plan en dLocal Go y devuelve la
   * subscribe_url para redirigir al usuario al checkout hosted.
   */
  getOrCreatePlan(
    plan:            SubscriptionPlan,
    notificationUrl: string,
    successUrl:      string,
    backUrl:         string,
    errorUrl:        string,
    cycle?:          BillingCycle,
  ): Promise<CreateCheckoutResult>;

  /**
   * Cancela una suscripción activa en dLocal Go.
   */
  cancelSubscription(planId: number, subscriptionId: number): Promise<void>;

  /**
   * Consulta el estado de una suscripción en dLocal Go.
   */
  getSubscription(planId: number, subscriptionId: number): Promise<SubscriptionDetails>;

  /**
   * Consulta una ejecución puntual (cobro) de una suscripción.
   */
  getExecution(subscriptionId: number, executionId: string): Promise<ExecutionDetails>;

  /**
   * Consulta un pago por su ID (usado tras recibir el webhook de dLocal Go).
   *
   * dLocal Go envía solo { "payment_id": "..." } en el notification_url.
   * Este método obtiene el estado y los identificadores completos del pago
   * para que HandleWebhookUseCase pueda procesar el evento correctamente.
   */
  getPayment(paymentId: string): Promise<PaymentDetails>;
}
