"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainController = void 0;
const BusinessRepository_1 = require("../../infrastructure/database/BusinessRepository");
const vercel_client_1 = require("../../infrastructure/vercel/vercel.client");
const errors_1 = require("../../domain/errors");
const public_cache_1 = require("../../infrastructure/cache/public.cache");
const logger_1 = require("../../infrastructure/logger");
const subscription_access_1 = require("../../domain/subscription-access");
const DOMAIN_REGEX = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
function normalizeDomain(input) {
    return input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");
}
class DomainController {
    constructor() {
        this.businessRepository = new BusinessRepository_1.BusinessRepository();
        this.get = async (req, res, next) => {
            try {
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                res.json({
                    custom_domain: business.custom_domain,
                    domain_verified: business.domain_verified,
                    domain_verified_at: business.domain_verified_at,
                    domain_added_at: business.domain_added_at,
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.add = async (req, res, next) => {
            try {
                const payload = req.body;
                const domain = normalizeDomain(payload.domain);
                if (!domain || !DOMAIN_REGEX.test(domain)) {
                    throw new errors_1.AppError("Dominio inválido", 400);
                }
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                if (!(0, subscription_access_1.canUseCustomDomain)(business.plan, business.trial_ends_at)) {
                    throw new errors_1.AppError("Los dominios personalizados están disponibles a partir del plan Pro.", 403);
                }
                const existing = await this.businessRepository.findByAnyCustomDomain(domain);
                if (existing && existing.id !== business.id) {
                    throw new errors_1.AppError("Este dominio ya está en uso", 409);
                }
                if (business.custom_domain && business.custom_domain !== domain) {
                    await vercel_client_1.vercelClient
                        .removeDomain(business.custom_domain)
                        .catch((err) => logger_1.logger.warn("Error eliminando dominio anterior de Vercel", { err }));
                }
                const vercelDomain = await vercel_client_1.vercelClient.addDomain(domain);
                await this.businessRepository.update(req.businessId, {
                    custom_domain: domain,
                    domain_verified: false,
                    domain_verified_at: null,
                    domain_added_at: new Date().toISOString(),
                });
                (0, public_cache_1.invalidateByBusinessId)(req.businessId);
                res.json({
                    message: "Dominio agregado. Configurá tu DNS y esperá la verificación.",
                    custom_domain: domain,
                    dns_instructions: vercelDomain.verification?.[0]
                        ? {
                            type: vercelDomain.verification[0].type,
                            name: vercelDomain.verification[0].domain,
                            value: vercelDomain.verification[0].value,
                            note: vercelDomain.verification[0].reason,
                        }
                        : {
                            type: "CNAME",
                            name: "@",
                            value: "cname.vercel-dns.com",
                            note: "Si tu proveedor no permite CNAME en el root (@), usá un registro A apuntando a 76.76.21.21",
                        },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.remove = async (req, res, next) => {
            try {
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                if (!business.custom_domain) {
                    throw new errors_1.AppError("No hay dominio personalizado configurado", 400);
                }
                await vercel_client_1.vercelClient
                    .removeDomain(business.custom_domain)
                    .catch((err) => logger_1.logger.warn("Error eliminando dominio de Vercel", { err }));
                await this.businessRepository.update(req.businessId, {
                    custom_domain: null,
                    domain_verified: false,
                    domain_verified_at: null,
                    domain_added_at: null,
                });
                (0, public_cache_1.invalidateByBusinessId)(req.businessId);
                res.json({ message: "Dominio eliminado correctamente" });
            }
            catch (error) {
                next(error);
            }
        };
        this.checkStatus = async (req, res, next) => {
            try {
                const business = await this.businessRepository.findById(req.businessId);
                if (!business)
                    throw new errors_1.NotFoundError("Negocio");
                if (!business.custom_domain) {
                    throw new errors_1.AppError("No hay dominio personalizado configurado", 400);
                }
                if (business.domain_verified) {
                    res.json({ verified: true, domain: business.custom_domain });
                    return;
                }
                const result = await vercel_client_1.vercelClient.checkDomain(business.custom_domain);
                if (result.verified && result.configured) {
                    await this.businessRepository.update(req.businessId, {
                        domain_verified: true,
                        domain_verified_at: new Date().toISOString(),
                    });
                    (0, public_cache_1.invalidateByBusinessId)(req.businessId);
                }
                res.json({
                    verified: result.verified && result.configured,
                    configured: result.configured,
                    domain: business.custom_domain,
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.DomainController = DomainController;
//# sourceMappingURL=DomainController.js.map