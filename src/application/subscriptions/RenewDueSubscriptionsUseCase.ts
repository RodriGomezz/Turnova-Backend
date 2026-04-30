import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { HandleWebhookUseCase } from "./HandleWebhookUseCase";
import { logger } from "../../infrastructure/logger";
import { Subscription } from "../../domain/entities/Subscription";

const RENEWAL_RETRY_INTERVAL_HOURS = 24;

export class RenewDueSubscriptionsUseCase {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly paymentProvider: IPaymentProvider,
    private readonly handleWebhookUseCase: HandleWebhookUseCase,
  ) {}

  async execute(now = new Date()): Promise<void> {
    const asOfIso = now.toISOString();
    const retryThreshold = new Date(now);
    retryThreshold.setHours(
      retryThreshold.getHours() - RENEWAL_RETRY_INTERVAL_HOURS,
    );

    const candidates = await this.subscriptionRepository.findRenewalCandidates(
      asOfIso,
      retryThreshold.toISOString(),
    );

    if (candidates.length === 0) return;

    logger.info(`Procesando ${candidates.length} suscripcion(es) para renovacion`, {
      asOfIso,
    });

    for (const subscription of candidates) {
      await this.processSubscription(subscription, asOfIso);
    }
  }

  private async processSubscription(
    subscription: Subscription,
    attemptedAtIso: string,
  ): Promise<void> {
    if (!subscription.dlocal_card_id) {
      logger.warn("Suscripcion sin card_id; no se puede renovar automaticamente", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
      });
      return;
    }

    if (!subscription.payer_email || !subscription.payer_document || !subscription.payer_name) {
      logger.warn("Suscripcion sin datos completos del titular; no se puede renovar", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
      });
      return;
    }

    const { firstName, lastName } = this.splitPayerName(subscription.payer_name);

    try {
      const result = await this.paymentProvider.chargeSavedCardSubscription({
        businessId: subscription.business_id,
        subscriptionId: subscription.dlocal_subscription_id,
        plan: subscription.plan,
        email: subscription.payer_email,
        firstName,
        lastName,
        document: subscription.payer_document,
        cardId: subscription.dlocal_card_id,
        networkPaymentReference: subscription.dlocal_network_tx_reference,
      });

      await this.subscriptionRepository.updateStatus(subscription.id, subscription.status, {
        dlocal_payment_id: result.paymentId,
        dlocal_card_brand: result.cardBrand ?? subscription.dlocal_card_brand,
        dlocal_card_last4: result.cardLast4 ?? subscription.dlocal_card_last4,
        dlocal_network_tx_reference:
          result.networkTxReference ?? subscription.dlocal_network_tx_reference,
        last_renewal_attempt_at: attemptedAtIso,
      });

      if (result.status === "active") {
        await this.handleWebhookUseCase.execute({
          id: result.paymentId,
          order_id: subscription.dlocal_subscription_id,
          status: "PAID",
        });
        return;
      }

      if (result.status === "rejected") {
        await this.handleWebhookUseCase.execute({
          id: result.paymentId,
          order_id: subscription.dlocal_subscription_id,
          status: "REJECTED",
        });
        return;
      }

      logger.info("Renovacion enviada y pendiente de confirmacion", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
        paymentId: result.paymentId,
      });
    } catch (error) {
      logger.error("Error renovando suscripcion automaticamente", {
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private splitPayerName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts.shift() ?? fullName;
    const lastName = parts.join(" ") || firstName;
    return { firstName, lastName };
  }
}
