import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IEmailService } from "../ports/IEmailService";
export interface DLocalGoWebhookPayload {
    id?: string;
    payment_id?: string;
    order_id?: string;
    status?: string;
}
export declare class HandleWebhookUseCase {
    private readonly subscriptionRepository;
    private readonly businessRepository;
    private readonly emailService;
    constructor(subscriptionRepository: ISubscriptionRepository, businessRepository: IBusinessRepository, emailService: IEmailService);
    execute(payload: DLocalGoWebhookPayload): Promise<void>;
    private handlePaymentPaid;
    private handlePaymentFailed;
    private handlePaymentCancelled;
    private handlePaymentRefunded;
    private findSubscription;
    private getPaymentId;
    private getOrderId;
    private normalizeStatus;
    private calcGracePeriodEnd;
    private fireAndForget;
}
//# sourceMappingURL=HandleWebhookUseCase.d.ts.map