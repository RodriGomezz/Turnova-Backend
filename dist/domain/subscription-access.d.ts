import { Subscription } from "./entities/Subscription";
export declare function hasActiveTrial(trialEndsAt: string | null): boolean;
export declare function canUseCustomDomain(plan: string, _trialEndsAt: string | null): boolean;
export declare function shouldDegradeExpiredGracePeriod(subscription: Subscription, now?: Date): boolean;
export declare function shouldDegradeEndedCanceledSubscription(subscription: Subscription, now?: Date): boolean;
//# sourceMappingURL=subscription-access.d.ts.map