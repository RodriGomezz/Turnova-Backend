import { logger } from "../logger";

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
  if (!process.env.VERCEL_API_TOKEN) {
    throw new Error("Vercel client misconfigured: missing VERCEL_API_TOKEN");
  }

  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function buildProjectUrl(path: string, apiVersion = "v9"): string {
  const projectIdOrName = process.env.VERCEL_PROJECT_ID;

  if (!projectIdOrName) {
    throw new Error("Vercel client misconfigured: missing VERCEL_PROJECT_ID");
  }

  const params = new URLSearchParams();
  if (process.env.VERCEL_TEAM_ID) {
    params.set("teamId", process.env.VERCEL_TEAM_ID);
  }
  if (process.env.VERCEL_TEAM_SLUG) {
    params.set("slug", process.env.VERCEL_TEAM_SLUG);
  }

  const query = params.toString();
  return `${VERCEL_API}/${apiVersion}/projects/${projectIdOrName}${path}${query ? `?${query}` : ""}`;
}

async function parseResponse<T>(
  res: Response,
  domain: string,
  operation: string,
): Promise<T> {
  const body = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    let message =
      (body.error as { message?: string } | undefined)?.message ??
      res.statusText;

    if (res.status === 404) {
      message =
        "Project or team not found in Vercel. Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID/VERCEL_TEAM_SLUG.";
    }

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
    const res = await fetch(buildProjectUrl("/domains", "v10"), {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ name: domain }),
    });

    return parseResponse<VercelAddDomainResponse>(res, domain, "addDomain");
  },

  async removeDomain(domain: string): Promise<void> {
    const res = await fetch(buildProjectUrl(`/domains/${encodeURIComponent(domain)}`), {
      method: "DELETE",
      headers: buildHeaders(),
    });

    if (!res.ok && res.status !== 404) {
      const body = (await res.json()) as Record<string, unknown>;
      let message =
        (body.error as { message?: string } | undefined)?.message ??
        res.statusText;

      if (res.status === 404) {
        message =
          "Project or team not found in Vercel. Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID/VERCEL_TEAM_SLUG.";
      }

      logger.error("Vercel removeDomain error", {
        domain,
        status: res.status,
        message,
      });
      throw new Error(`Vercel error: ${message}`);
    }
  },

  async checkDomain(domain: string): Promise<VercelCheckDomainResponse> {
    const res = await fetch(buildProjectUrl(`/domains/${encodeURIComponent(domain)}`), {
      method: "GET",
      headers: buildHeaders(),
    });

    return parseResponse<VercelCheckDomainResponse>(res, domain, "checkDomain");
  },
};
