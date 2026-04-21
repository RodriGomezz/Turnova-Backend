"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidatePublicCache = void 0;
const public_cache_1 = require("../../infrastructure/cache/public.cache");
const invalidatePublicCache = (req, res, next) => {
    res.on("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const businessId = req.businessId;
            if (businessId)
                (0, public_cache_1.invalidateByBusinessId)(businessId);
        }
    });
    next();
};
exports.invalidatePublicCache = invalidatePublicCache;
//# sourceMappingURL=invalidate-cache.middleware.js.map