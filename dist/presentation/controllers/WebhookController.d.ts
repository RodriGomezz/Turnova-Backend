import { Request, Response, NextFunction } from "express";
import { HandleWebhookUseCase } from "../../application/subscriptions/HandleWebhookUseCase";
export declare class WebhookController {
    private readonly handleWebhookUseCase;
    constructor(handleWebhookUseCase: HandleWebhookUseCase);
    /**
     * POST /api/subscriptions/dlocal
     *
     * dLocal envía el objeto pago completo. También toleramos el formato reducido
     * { payment_id, order_id, status } para compatibilidad.
     *
     * La firma usa HMAC-SHA256 sobre el body raw con el API Secret como clave.
     * Header: X-Signature
     */
    handleDLocal: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private verifySignature;
}
//# sourceMappingURL=WebhookController.d.ts.map