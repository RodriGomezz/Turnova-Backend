"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ConflictError = exports.ValidationError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.AppError = void 0;
const logger_1 = require("../../infrastructure/logger");
const errors_1 = require("../../domain/errors");
// Re-exportar para que los imports existentes de presentation no se rompan
var errors_2 = require("../../domain/errors");
Object.defineProperty(exports, "AppError", { enumerable: true, get: function () { return errors_2.AppError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return errors_2.NotFoundError; } });
Object.defineProperty(exports, "UnauthorizedError", { enumerable: true, get: function () { return errors_2.UnauthorizedError; } });
Object.defineProperty(exports, "ForbiddenError", { enumerable: true, get: function () { return errors_2.ForbiddenError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_2.ValidationError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return errors_2.ConflictError; } });
const errorHandler = (err, req, res, _next) => {
    const isDev = process.env.NODE_ENV === "development";
    if (err instanceof errors_1.AppError) {
        if (err.statusCode >= 500) {
            logger_1.logger.error("Error operacional 5xx", {
                message: err.message,
                path: req.path,
                method: req.method,
            });
        }
        res.status(err.statusCode).json({
            error: err.message,
            code: err.name,
            ...(isDev && { stack: err.stack }),
        });
        return;
    }
    logger_1.logger.error("Error inesperado", {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
    });
    res.status(500).json({
        error: isDev ? err.message : "Error interno del servidor",
        code: "INTERNAL_ERROR",
        ...(isDev && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.middleware.js.map