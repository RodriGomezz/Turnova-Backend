import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IPaymentProvider } from "../ports/IPaymentProvider";
import { SubscriptionPlan } from "../../domain/entities/Subscription";
export interface CreateSubscriptionInput {
    businessId: string;
    plan: SubscriptionPlan;
    email: string;
    firstName: string;
    lastName: string;
    frontendUrl: string;
}
export declare class CreateSubscriptionUseCase {
    private readonly subscriptionRepository;
    private readonly businessRepository;
    private readonly paymentProvider;
    constructor(subscriptionRepository: ISubscriptionRepository, businessRepository: IBusinessRepository, paymentProvider: IPaymentProvider);
    execute(input: CreateSubscriptionInput): Promise<{
        checkoutUrl: string;
    }>;
}
//# sourceMappingURL=CreateSubscriptionUseCase.d.ts.map