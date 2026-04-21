import { Request, Response, NextFunction } from "express";
import { ISubscriptionRepository } from "../../domain/interfaces/ISubscriptionRepository";
import { IPaymentProvider } from "../../application/ports/IPaymentProvider";
import { CreateSubscriptionUseCase } from "../../application/subscriptions/CreateSubscriptionUseCase";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
export declare class SubscriptionController {
    private readonly subscriptionRepository;
    private readonly paymentProvider;
    private readonly createSubscriptionUseCase;
    private readonly userRepository;
    private readonly businessRepository;
    constructor(subscriptionRepository: ISubscriptionRepository, paymentProvider: IPaymentProvider, createSubscriptionUseCase: CreateSubscriptionUseCase, userRepository: IUserRepository, businessRepository: IBusinessRepository);
    /** GET /api/subscriptions — estado actual de la suscripción */
    get: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /** POST /api/subscriptions — iniciar checkout */
    create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /** POST /api/subscriptions/cancel — cancelar suscripción
     * Usamos POST en lugar de DELETE porque algunos proxies/CDNs descartan el body en DELETE. */
    cancel: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /** GET /api/subscriptions/history — historial de pagos via dLocal */
    getHistory: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=SubscriptionController.d.ts.map