import { SubscriptionPlan } from "../../domain/entities/Subscription";

// ── Tipos de entrada ──────────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  businessId: string;
  plan: SubscriptionPlan;
  /** Email del titular de la suscripción */
  email: string;
  /** Nombre del titular que aparece en el cobro */
  firstName: string;
  /** Apellido del titular que aparece en el cobro */
  lastName: string;
  /** URL a la que redirige dLocal después del pago */
  successUrl: string;
  cancelUrl: string;
}

// ── Tipos de salida ───────────────────────────────────────────────────────────

export interface CreateSubscriptionResult {
  /** ID de la suscripción en dLocal */
  subscriptionId: string;
  /** URL del checkout al que redirigir al usuario */
  checkoutUrl: string;
  /** Fecha en que se cobrará el siguiente período */
  nextBillingDate: string;
}

export interface SubscriptionDetails {
  subscriptionId: string;
  status: "active" | "paused" | "canceled";
  nextBillingDate: string | null;
}

/**
 * Detalles de un pago individual en dLocal Go.
 * Se usa en el webhook handler para recuperar el order_id cuando dLocal
 * no lo incluye en el payload del webhook (comportamiento conocido de dLocal Go).
 */
export interface PaymentDetails {
  paymentId: string;
  /** order_id que fue enviado al crear el pago — coincide con dlocal_subscription_id en DB */
  orderId: string | null;
  status: string;
}

// ── Puerto (interfaz) ─────────────────────────────────────────────────────────

export interface IPaymentProvider {
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  refundPayment(paymentId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<SubscriptionDetails>;
  /**
   * Obtiene los detalles de un pago individual por su ID.
   * Usado como fallback en el webhook handler cuando dLocal Go
   * no envía el order_id en el payload del webhook.
   */
  getPaymentDetails(paymentId: string): Promise<PaymentDetails>;
}