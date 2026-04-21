"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSubscriptionSchema = exports.createSubscriptionSchema = void 0;
const zod_1 = require("zod");
exports.createSubscriptionSchema = zod_1.z.object({
    plan: zod_1.z.enum(["starter", "pro", "business"]),
    firstName: zod_1.z.string().min(2).max(80).trim(),
    lastName: zod_1.z.string().min(2).max(80).trim(),
    email: zod_1.z.string().email().toLowerCase().trim(),
});
exports.cancelSubscriptionSchema = zod_1.z.object({
    confirm: zod_1.z.literal(true, { error: "Debes confirmar la cancelación" }),
});
//# sourceMappingURL=subscription.schema.js.map