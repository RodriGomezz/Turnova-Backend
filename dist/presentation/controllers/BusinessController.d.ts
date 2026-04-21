import { Request, Response, NextFunction } from "express";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { IUserBusinessAccess } from "../../domain/interfaces/IUserBusinessAccess";
export declare class BusinessController {
    private readonly businessRepository;
    private readonly barberRepository;
    private readonly userRepository;
    private readonly userBusinessAccess;
    constructor(businessRepository: IBusinessRepository, barberRepository: IBarberRepository, userRepository: IUserRepository, userBusinessAccess: IUserBusinessAccess);
    get: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    completeOnboarding: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    switchBusiness: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listUserBusinesses: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deactivate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    reactivate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    deleteBranch: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private assertAccessAndNotPrincipal;
    private switchToPrincipalIfActive;
}
//# sourceMappingURL=BusinessController.d.ts.map