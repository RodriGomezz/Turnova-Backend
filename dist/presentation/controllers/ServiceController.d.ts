import { Request, Response, NextFunction } from "express";
import { IServiceRepository } from "../../domain/interfaces/IServiceRepository";
import { CreateServiceUseCase } from "../../application/services/CreateServiceUseCase";
export declare class ServiceController {
    private readonly serviceRepository;
    private readonly createServiceUseCase;
    constructor(serviceRepository: IServiceRepository, createServiceUseCase: CreateServiceUseCase);
    list: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    listDefaults: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=ServiceController.d.ts.map