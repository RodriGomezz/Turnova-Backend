import { Request, Response, NextFunction } from "express";
export declare class BarberController {
    private readonly barberRepository;
    private readonly businessRepository;
    private readonly createBarberUseCase;
    private readonly listBarbersUseCase;
    constructor();
    list: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=BarberController.d.ts.map