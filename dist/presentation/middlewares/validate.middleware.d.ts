import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
interface Schemas {
    body?: ZodType;
    params?: ZodType;
    query?: ZodType;
}
export declare const validate: (schema: ZodType | Schemas) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validate.middleware.d.ts.map