import { z } from "zod";
export declare const createSubscriptionSchema: z.ZodObject<{
    plan: z.ZodEnum<{
        starter: "starter";
        pro: "pro";
        business: "business";
    }>;
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
}, z.core.$strip>;
export declare const cancelSubscriptionSchema: z.ZodObject<{
    confirm: z.ZodLiteral<true>;
}, z.core.$strip>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
//# sourceMappingURL=subscription.schema.d.ts.map