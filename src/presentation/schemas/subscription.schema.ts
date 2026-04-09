import { z } from "zod";

export const createSubscriptionSchema = z.object({
  plan: z.enum(["pro", "business"]),
});

export const cancelSubscriptionSchema = z.object({
  confirm: z.literal(true, { error: "Debes confirmar la cancelación" }),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
