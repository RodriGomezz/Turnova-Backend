import { Request, Response, NextFunction } from "express";
import { invalidateByBusinessId } from "../../infrastructure/cache/public.cache";

export const invalidatePublicCache = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const businessId = req.businessId;
      if (businessId) invalidateByBusinessId(businessId);
    }
  });
  next();
};
