export type BusinessStatus = "active" | "trial" | "trial_expired" | "paused";
export declare function getBusinessStatus(business: {
    plan: string;
    trial_ends_at: string | null;
    activo: boolean;
}): BusinessStatus;
//# sourceMappingURL=business-status.d.ts.map