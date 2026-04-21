import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Subscription, SubscriptionPlan, SubscriptionState } from '../../domain/models/subscription.model';
import { BusinessPlan } from '../../domain/models/business.model';
export interface SubscriptionPayerInput {
    firstName: string;
    lastName: string;
    email: string;
}
export declare function calcTrialDaysLeft(trialEndsAt: string | null): number | null;
export declare function calcIsPro(plan: BusinessPlan | string, trialEndsAt: string | null): boolean;
export declare function calcCanUseCustomDomain(plan: BusinessPlan | string, _trialEndsAt?: string | null): boolean;
interface CancelResponse {
    message: string;
    currentPeriodEnd?: string;
}
export declare class SubscriptionService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    get(): Observable<Subscription | null>;
    getState(): Observable<SubscriptionState>;
    create(plan: SubscriptionPlan, payer: SubscriptionPayerInput): Observable<string>;
    cancel(): Observable<CancelResponse>;
}
export {};
//# sourceMappingURL=subscription.service.d.ts.map