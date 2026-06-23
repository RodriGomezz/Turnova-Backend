import { Business } from "../entities/Business";

export interface IBusinessRepository {
  findById(id: string): Promise<Business | null>;
  findBySlug(slug: string): Promise<Business | null>;
  findByCustomDomain(domain: string): Promise<Business | null>;
  findByAnyCustomDomain(domain: string): Promise<Business | null>;
  /** Hostnames de dominios propios verificados — para allowedHosts dinámico en SSR */
  findAllVerifiedDomains(): Promise<string[]>;
  /** Slugs de negocios activos — para generar el sitemap dinámico */
  findAllActiveSlugs(): Promise<{ slug: string; createdAt: string }[]>;
  create(data: Omit<Business, "id" | "created_at" | "domain_verified" | "domain_verified_at" | "domain_added_at" | "onboarding_completed" | "subscription_downgraded_at">): Promise<Business>;
  update(id: string, data: Partial<Business>): Promise<Business>;
  delete(id: string): Promise<void>;
}
