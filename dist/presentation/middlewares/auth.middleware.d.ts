import { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            businessId?: string;
        }
    }
}
export declare function invalidateUserCache(userId: string): void;
export declare const authMiddleware: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map