"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dlocalClient = void 0;
const logger_1 = require("../logger");
const plan_prices_1 = require("../../domain/plan-prices");
const DLOCAL_GO_SANDBOX_API = "https://api-sbx.dlocalgo.com";
const DLOCAL_GO_PROD_API = "https://api.dlocalgo.com";
const COUNTRY_CODE = "UY";
const CURRENCY = "UYU";
function getBaseUrl() {
    return process.env.DLOCAL_SANDBOX === "true"
        ? DLOCAL_GO_SANDBOX_API
        : DLOCAL_GO_PROD_API;
}
// function buildHeaders(): Record<string, string> {
//   return {
//     "X-Api-Key":    process.env.DLOCAL_API_KEY    ?? "",
//     "X-Api-Secret": process.env.DLOCAL_API_SECRET ?? "",
//     "Content-Type": "application/json",
//   };
// }
function buildHeaders() {
    const apiKey = process.env.DLOCAL_API_KEY ?? "";
    const apiSecret = process.env.DLOCAL_API_SECRET ?? "";
    return {
        "Authorization": `Bearer ${apiKey}:${apiSecret}`,
        "Content-Type": "application/json",
    };
}
async function parseResponse(res, operation, context = {}) {
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    }
    catch {
        logger_1.logger.error(`dLocal Go ${operation}: respuesta no es JSON`, { text, ...context });
        throw new Error(`dLocal Go error: respuesta inválida (${res.status})`);
    }
    if (!res.ok) {
        const err = body;
        logger_1.logger.error(`dLocal Go ${operation} error`, {
            ...context, status: res.status, code: err.code, message: err.message,
        });
        throw new Error(`dLocal Go [${err.code}]: ${err.message}`);
    }
    return body;
}
exports.dlocalClient = {
    async createSubscription(input) {
        const amount = plan_prices_1.PLAN_PRICES[input.plan];
        const orderId = `${input.businessId}_${Date.now()}`;
        const payload = {
            country_code: COUNTRY_CODE,
            currency: CURRENCY,
            amount,
            success_url: input.successUrl,
            back_url: input.cancelUrl,
            notification_url: `${process.env.API_URL ?? "http://localhost:3000"}/api/subscriptions/dlocal`,
            order_id: orderId,
            description: `Turnio Plan ${input.plan} — suscripción mensual`,
            payer: {
                name: `${input.firstName} ${input.lastName}`.trim(),
                email: input.email,
            },
        };
        logger_1.logger.info("dLocal Go createPayment", {
            businessId: input.businessId,
            plan: input.plan,
            amount,
            orderId,
            sandbox: process.env.DLOCAL_SANDBOX,
        });
        const res = await fetch(`${getBaseUrl()}/v1/payments`, {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify(payload),
        });
        console.log(res, 'res');
        const data = await parseResponse(res, "createPayment", { businessId: input.businessId, orderId });
        console.log(data, 'data');
        if (!data.redirect_url) {
            throw new Error("dLocal Go no devolvió una redirect_url");
        }
        const nextBillingDate = new Date();
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
        return {
            subscriptionId: orderId,
            checkoutUrl: data.redirect_url,
            nextBillingDate: nextBillingDate.toISOString(),
        };
    },
    async cancelSubscription(subscriptionId) {
        logger_1.logger.info("dLocal Go cancelSubscription", { subscriptionId });
        const res = await fetch(`${getBaseUrl()}/v1/subscriptions/${subscriptionId}/cancel`, { method: "POST", headers: buildHeaders() });
        if (!res.ok && res.status !== 404) {
            const text = await res.text();
            let body = { code: res.status, message: text };
            try {
                body = JSON.parse(text);
            }
            catch { /* noop */ }
            throw new Error(`dLocal Go [${body.code}]: ${body.message}`);
        }
    },
    async getSubscription(subscriptionId) {
        const res = await fetch(`${getBaseUrl()}/v1/subscriptions/${subscriptionId}`, { method: "GET", headers: buildHeaders() });
        const data = await parseResponse(res, "getSubscription", { subscriptionId });
        return {
            subscriptionId: data.id,
            status: mapDLocalGoStatus(data.status),
            nextBillingDate: data.next_charge_at,
        };
    },
};
function mapDLocalGoStatus(status) {
    switch (status) {
        case "active": return "active";
        case "paused": return "paused";
        case "canceled": return "canceled";
    }
}
//# sourceMappingURL=dlocal.client.js.map