import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export const validate =
  (schema: ZodType | Schemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const schemas: Schemas =
      schema instanceof ZodType ? { body: schema } : schema;

    const errors: Record<string, unknown> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) errors["body"] = result.error.flatten().fieldErrors;
      else req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success)
        errors["params"] = result.error.flatten().fieldErrors;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) errors["query"] = result.error.flatten().fieldErrors;
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        error: "Datos inválidos",
        code: "VALIDATION_ERROR",
        details: errors,
      });
      return;
    }

    next();
  };
