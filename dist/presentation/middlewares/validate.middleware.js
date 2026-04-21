"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => (req, res, next) => {
    const schemas = schema instanceof zod_1.ZodType ? { body: schema } : schema;
    const errors = {};
    if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success)
            errors["body"] = result.error.flatten().fieldErrors;
        else
            req.body = result.data;
    }
    if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success)
            errors["params"] = result.error.flatten().fieldErrors;
    }
    if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success)
            errors["query"] = result.error.flatten().fieldErrors;
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
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map