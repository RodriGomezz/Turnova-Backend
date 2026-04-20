import { Request, Response, NextFunction } from "express";
import { BusinessRepository } from "../../infrastructure/database/BusinessRepository";
import { vercelClient } from "../../infrastructure/vercel/vercel.client";
import { AppError, NotFoundError } from "../../domain/errors";
import { invalidateByBusinessId } from "../../infrastructure/cache/public.cache";
import { logger } from "../../infrastructure/logger";
import { canUseCustomDomain } from "../../domain/subscription-access";

const DOMAIN_REGEX = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export class DomainController {
  private readonly businessRepository = new BusinessRepository();

  get = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      res.json({
        custom_domain: business.custom_domain,
        domain_verified: business.domain_verified,
        domain_verified_at: business.domain_verified_at,
        domain_added_at: business.domain_added_at,
      });
    } catch (error) {
      next(error);
    }
  };

  add = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payload = req.body as { domain: string };
      const domain = normalizeDomain(payload.domain);

      if (!domain || !DOMAIN_REGEX.test(domain)) {
        throw new AppError("Dominio inválido", 400);
      }

      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      if (!canUseCustomDomain(business.plan, business.trial_ends_at)) {
        throw new AppError(
          "Los dominios personalizados están disponibles a partir del plan Pro.",
          403,
        );
      }

      const existing = await this.businessRepository.findByAnyCustomDomain(domain);
      if (existing && existing.id !== business.id) {
        throw new AppError("Este dominio ya está en uso", 409);
      }

      if (business.custom_domain && business.custom_domain !== domain) {
        await vercelClient
          .removeDomain(business.custom_domain)
          .catch((err) =>
            logger.warn("Error eliminando dominio anterior de Vercel", { err }),
          );
      }

      const vercelDomain = await vercelClient.addDomain(domain);

      await this.businessRepository.update(req.businessId!, {
        custom_domain: domain,
        domain_verified: false,
        domain_verified_at: null,
        domain_added_at: new Date().toISOString(),
      } as any);

      invalidateByBusinessId(req.businessId!);

      res.json({
        message: "Dominio agregado. Configurá tu DNS y esperá la verificación.",
        custom_domain: domain,
        dns_instructions:
          vercelDomain.verification?.[0]
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
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      if (!business.custom_domain) {
        throw new AppError("No hay dominio personalizado configurado", 400);
      }

      await vercelClient
        .removeDomain(business.custom_domain)
        .catch((err) =>
          logger.warn("Error eliminando dominio de Vercel", { err }),
        );

      await this.businessRepository.update(req.businessId!, {
        custom_domain: null,
        domain_verified: false,
        domain_verified_at: null,
        domain_added_at: null,
      } as any);

      invalidateByBusinessId(req.businessId!);

      res.json({ message: "Dominio eliminado correctamente" });
    } catch (error) {
      next(error);
    }
  };

  checkStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const business = await this.businessRepository.findById(req.businessId!);
      if (!business) throw new NotFoundError("Negocio");

      if (!business.custom_domain) {
        throw new AppError("No hay dominio personalizado configurado", 400);
      }

      if (business.domain_verified) {
        res.json({ verified: true, domain: business.custom_domain });
        return;
      }

      const result = await vercelClient.checkDomain(business.custom_domain);

      if (result.verified && result.configured) {
        await this.businessRepository.update(req.businessId!, {
          domain_verified: true,
          domain_verified_at: new Date().toISOString(),
        } as any);

        invalidateByBusinessId(req.businessId!);
      }

      res.json({
        verified: result.verified && result.configured,
        configured: result.configured,
        domain: business.custom_domain,
      });
    } catch (error) {
      next(error);
    }
  };
}
