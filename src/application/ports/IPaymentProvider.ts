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

// ── Puerto (interfaz) ─────────────────────────────────────────────────────────

export interface IPaymentProvider {
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<SubscriptionDetails>;
}
