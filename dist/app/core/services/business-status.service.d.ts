export type PlanStatus = 'trial_active' | 'trial_grace' | 'trial_expired' | 'starter' | 'pro_active' | 'business_active' | 'payment_pending' | 'payment_grace';
export declare class BusinessStatusService {
    private readonly businessService;
    private readonly subscriptionService;
    readonly business: any;
    readonly subscription: any;
    readonly loaded: any;
    readonly planStatus: any;
    readonly isPro: any;
    readonly isBusiness: any;
    readonly trialDaysLeft: any;
    readonly trialGraceDaysLeft: any;
    /**
     * Banner informativo — solo se muestra si no hay suscripción activa
     * o si hay un problema de pago.
     */
    readonly bannerInfo: any;
    load(): any;
    refresh(): any;
}
//# sourceMappingURL=business-status.service.d.ts.map