import { Request, Response, NextFunction } from "express";
export declare class DomainController {
    private readonly businessRepository;
    get: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    add: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    remove: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    checkStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=DomainController.d.ts.map