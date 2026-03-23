import { logger } from "../logger";

interface VercelDomain {
  name: string;
  verified: boolean;
  configured: boolean;
}

interface VercelDomainVerification {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface VercelAddDomainResponse {
  name: string;
  verified: boolean;
  configured: boolean;
  verification?: VercelDomainVerification[];
  error?: { code: string; message: string };
}

export interface VercelCheckDomainResponse {
  name: string;
  verified: boolean;
  configured: boolean;
}

const VERCEL_API = "https://api.vercel.com";

function buildHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function buildProjectUrl(path: string): string {
  const teamQuery = process.env.VERCEL_TEAM_ID
    ? `?teamId=${process.env.VERCEL_TEAM_ID}`
    : "";
  return `${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}${path}${teamQuery}`;
}

async function parseResponse<T>(
  res: Response,
  domain: string,
  operation: string,
): Promise<T> {
  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const message =
      (body.error as { message?: string } | undefined)?.message ??
      res.statusText;
    logger.error(`Vercel ${operation} error`, {
      domain,
      status: res.status,
      message,
    });
    throw new Error(`Vercel error: ${message}`);
  }

  return body as T;
}

export const vercelClient = {
  async addDomain(domain: string): Promise<VercelAddDomainResponse> {
    const res = await fetch(buildProjectUrl("/domains"), {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ name: domain }),
    });

    return parseResponse<VercelAddDomainResponse>(res, domain, "addDomain");
  },

  async removeDomain(domain: string): Promise<void> {
    const res = await fetch(buildProjectUrl(`/domains/${domain}`), {
      method: "DELETE",
      headers: buildHeaders(),
    });

    if (!res.ok && res.status !== 404) {
      const body = (await res.json()) as Record<string, unknown>;
      const message =
        (body.error as { message?: string } | undefined)?.message ??
        res.statusText;
      logger.error("Vercel removeDomain error", {
        domain,
        status: res.status,
        message,
      });
      throw new Error(`Vercel error: ${message}`);
    }
  },

  async checkDomain(domain: string): Promise<VercelCheckDomainResponse> {
    const res = await fetch(buildProjectUrl(`/domains/${domain}`), {
      method: "GET",
      headers: buildHeaders(),
    });

    return parseResponse<VercelCheckDomainResponse>(res, domain, "checkDomain");
  },
};
