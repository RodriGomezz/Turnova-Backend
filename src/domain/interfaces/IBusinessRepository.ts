import { Business } from "../entities/Business";

export interface IBusinessRepository {
  findById(id: string): Promise<Business | null>;
  findBySlug(slug: string): Promise<Business | null>;
  findByCustomDomain(domain: string): Promise<Business | null>;
  create(data: Omit<Business, "id" | "created_at" | "domain_verified" | "domain_verified_at" | "domain_added_at" | "onboarding_completed">): Promise<Business>;
  update(id: string, data: Partial<Business>): Promise<Business>;
  delete(id: string): Promise<void>;
}
