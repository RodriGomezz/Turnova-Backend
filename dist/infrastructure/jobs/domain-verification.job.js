"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDomainVerificationJob = startDomainVerificationJob;
const supabase_client_1 = require("../database/supabase.client");
const vercel_client_1 = require("../vercel/vercel.client");
const logger_1 = require("../logger");
const INTERVAL_MS = parseInt(process.env.DOMAIN_CHECK_INTERVAL_MS ?? "300000");
async function verifyPendingDomains() {
    const { data: businesses, error } = await supabase_client_1.supabase
        .from("businesses")
        .select("id, slug, custom_domain")
        .not("custom_domain", "is", null)
        .eq("domain_verified", false);
    if (error) {
        logger_1.logger.error("Error fetching pending domains", { error });
        return;
    }
    if (!businesses || businesses.length === 0)
        return;
    logger_1.logger.info(`Verificando ${businesses.length} dominio(s) pendiente(s)`);
    for (const business of businesses) {
        try {
            const result = await vercel_client_1.vercelClient.checkDomain(business.custom_domain);
            if (result.verified && result.configured) {
                await supabase_client_1.supabase
                    .from("businesses")
                    .update({
                    domain_verified: true,
                    domain_verified_at: new Date().toISOString(),
                })
                    .eq("id", business.id);
                logger_1.logger.info("Dominio verificado", {
                    businessId: business.id,
                    domain: business.custom_domain,
                });
            }
        }
        catch (err) {
            logger_1.logger.warn("Error verificando dominio", {
                businessId: business.id,
                domain: business.custom_domain,
                error: err instanceof Error ? err.message : err,
            });
        }
    }
}
function startDomainVerificationJob() {
    if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_PROJECT_ID) {
        logger_1.logger.warn("VERCEL_API_TOKEN o VERCEL_PROJECT_ID no configurados — job de verificación deshabilitado");
        return;
    }
    logger_1.logger.info(`Job de verificación de dominios iniciado (cada ${INTERVAL_MS / 1000}s)`);
    // Correr inmediatamente al iniciar
    verifyPendingDomains().catch((err) => logger_1.logger.error("Error en primera ejecución del job", { err }));
    setInterval(() => {
        verifyPendingDomains().catch((err) => logger_1.logger.error("Error en job de verificación", { err }));
    }, INTERVAL_MS);
}
//# sourceMappingURL=domain-verification.job.js.map