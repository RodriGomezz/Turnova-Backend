import { Request, Response, NextFunction } from "express";
export { AppError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError, } from "../../domain/errors";
export declare const errorHandler: (err: Error, req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=errorHandler.middleware.d.ts.map