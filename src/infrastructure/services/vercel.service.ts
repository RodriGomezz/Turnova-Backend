import { logger } from "../../../dist/infrastructure/logger";

const VERCEL_API = "https://api.vercel.com";
const PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
const TEAM_ID = process.env.VERCEL_TEAM_ID;       // opcional
const TOKEN = process.env.VERCEL_API_TOKEN!;
const BASE_DOMAIN = process.env.BASE_DOMAIN!;      // kronu.pro

export class VercelService {
  private buildUrl(path: string): string {
    const url = new URL(`${VERCEL_API}${path}`);
    if (TEAM_ID) url.searchParams.set("teamId", TEAM_ID);
    return url.toString();
  }

  private headers() {
    return {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Registra los dos dominios de un tenant en Vercel:
   *   kevin-barberia.kronu.pro
   *   www.kevin-barberia.kronu.pro
   *
   * Si alguno ya existe (409) lo ignora silenciosamente.
   * Nunca lanza error — un fallo aquí no debe romper el registro del negocio.
   */
  async provisionDomains(slug: string): Promise<void> {
    if (!TOKEN || !PROJECT_ID || !BASE_DOMAIN) {
      logger.warn("VercelService: variables de entorno faltantes, saltando provisión de dominios");
      return;
    }

    const domains = [
      `${slug}.${BASE_DOMAIN}`,
      `www.${slug}.${BASE_DOMAIN}`,
    ];

    for (const domain of domains) {
      try {
        const res = await fetch(
          this.buildUrl(`/v9/projects/${PROJECT_ID}/domains`),
          {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ name: domain }),
          },
        );

        if (res.ok) {
          logger.info(`VercelService: dominio registrado → ${domain}`);
        } else if (res.status === 409) {
          logger.info(`VercelService: dominio ya existía → ${domain}`);
        } else {
          const body = await res.json().catch(() => ({}));
          logger.warn(`VercelService: error al registrar ${domain}`, { status: res.status, body });
        }
      } catch (err) {
        logger.error(`VercelService: excepción al registrar ${domain}`, { err });
      }
    }
  }

  /**
   * Elimina los dos dominios de un tenant de Vercel al borrar el negocio.
   * Nunca lanza error.
   */
  async removeDomains(slug: string): Promise<void> {
    if (!TOKEN || !PROJECT_ID || !BASE_DOMAIN) return;

    const domains = [
      `${slug}.${BASE_DOMAIN}`,
      `www.${slug}.${BASE_DOMAIN}`,
    ];

    for (const domain of domains) {
      try {
        const res = await fetch(
          this.buildUrl(`/v9/projects/${PROJECT_ID}/domains/${domain}`),
          {
            method: "DELETE",
            headers: this.headers(),
          },
        );

        if (res.ok || res.status === 404) {
          logger.info(`VercelService: dominio eliminado → ${domain}`);
        } else {
          const body = await res.json().catch(() => ({}));
          logger.warn(`VercelService: error al eliminar ${domain}`, { status: res.status, body });
        }
      } catch (err) {
        logger.error(`VercelService: excepción al eliminar ${domain}`, { err });
      }
    }
  }
}

export const vercelService = new VercelService();