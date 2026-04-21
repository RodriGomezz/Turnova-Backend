"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vercelClient = void 0;
const logger_1 = require("../logger");
const VERCEL_API = "https://api.vercel.com";
function buildHeaders() {
    if (!process.env.VERCEL_API_TOKEN) {
        throw new Error("Vercel client misconfigured: missing VERCEL_API_TOKEN");
    }
    return {
        Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
        "Content-Type": "application/json",
    };
}
function buildProjectUrl(path, apiVersion = "v9") {
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
async function parseResponse(res, domain, operation) {
    const body = (await res.json());
    if (!res.ok) {
        let message = body.error?.message ??
            res.statusText;
        if (res.status === 404) {
            message =
                "Project or team not found in Vercel. Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID/VERCEL_TEAM_SLUG.";
        }
        logger_1.logger.error(`Vercel ${operation} error`, {
            domain,
            status: res.status,
            message,
        });
        throw new Error(`Vercel error: ${message}`);
    }
    return body;
}
exports.vercelClient = {
    async addDomain(domain) {
        const res = await fetch(buildProjectUrl("/domains", "v10"), {
            method: "POST",
            headers: buildHeaders(),
            body: JSON.stringify({ name: domain }),
        });
        return parseResponse(res, domain, "addDomain");
    },
    async removeDomain(domain) {
        const res = await fetch(buildProjectUrl(`/domains/${encodeURIComponent(domain)}`), {
            method: "DELETE",
            headers: buildHeaders(),
        });
        if (!res.ok && res.status !== 404) {
            const body = (await res.json());
            let message = body.error?.message ??
                res.statusText;
            if (res.status === 404) {
                message =
                    "Project or team not found in Vercel. Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID/VERCEL_TEAM_SLUG.";
            }
            logger_1.logger.error("Vercel removeDomain error", {
                domain,
                status: res.status,
                message,
            });
            throw new Error(`Vercel error: ${message}`);
        }
    },
    async checkDomain(domain) {
        const res = await fetch(buildProjectUrl(`/domains/${encodeURIComponent(domain)}`), {
            method: "GET",
            headers: buildHeaders(),
        });
        return parseResponse(res, domain, "checkDomain");
    },
};
//# sourceMappingURL=vercel.client.js.map