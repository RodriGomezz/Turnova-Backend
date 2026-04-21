"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = require("../../infrastructure/logger");
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const method = req.method;
        const path = req.path;
        const msg = `${method} ${path} → ${status} (${duration}ms)`;
        if (status >= 500) {
            logger_1.logger.error(msg);
        }
        else if (status >= 400) {
            logger_1.logger.warn(msg);
        }
        else {
            logger_1.logger.http(msg);
        }
    });
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=requestLogger.middleware.js.map