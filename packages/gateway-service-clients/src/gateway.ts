import type { BackfillRunRecord, GatewayConnection, GatewayTokenResult } from "@repo/gateway-types";

import type { ServiceClientConfig } from "./headers.js";
import { buildServiceHeaders } from "./headers.js";
import { gatewayUrl } from "./urls.js";

/**
 * Create a typed HTTP client for the gateway service.
 *
 * @example
 * const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY, requestSource: "backfill" });
 * const conn = await gw.getConnection("inst-123");
 */
export function createGatewayClient(config: ServiceClientConfig) {
  const h = buildServiceHeaders(config);

  return {
    async getConnection(installationId: string): Promise<GatewayConnection> {
      const response = await fetch(
        `${gatewayUrl}/gateway/${installationId}`,
        { headers: h, signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) {
        throw new Error(`Gateway getConnection failed: ${response.status} for ${installationId}`);
      }
      return response.json() as Promise<GatewayConnection>;
    },

    async getToken(installationId: string): Promise<GatewayTokenResult> {
      const response = await fetch(
        `${gatewayUrl}/gateway/${installationId}/token`,
        { headers: h, signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) {
        throw new Error(`Gateway getToken failed: ${response.status} for ${installationId}`);
      }
      return response.json() as Promise<GatewayTokenResult>;
    },

    async getBackfillRuns(
      installationId: string,
      status?: string,
    ): Promise<BackfillRunRecord[]> {
      const url = `${gatewayUrl}/gateway/${installationId}/backfill-runs${status ? `?status=${status}` : ""}`;
      const response = await fetch(url, {
        headers: h,
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);

      if (!response?.ok) { return []; }
      return response.json() as Promise<BackfillRunRecord[]>;
    },

    async upsertBackfillRun(
      installationId: string,
      record: Record<string, unknown>,
    ): Promise<void> {
      await fetch(`${gatewayUrl}/gateway/${installationId}/backfill-runs`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => { /* best-effort */ });
    },

    /**
     * Get OAuth authorize URL from the gateway.
     * Console-specific: requires orgId and userId context headers.
     */
    async getAuthorizeUrl(
      provider: string,
      context: { orgId: string; userId: string; redirectTo?: string },
    ): Promise<{ url: string; state: string }> {
      const qs = context.redirectTo ? `?redirect_to=${context.redirectTo}` : "";
      const response = await fetch(
        `${gatewayUrl}/gateway/${provider}/authorize${qs}`,
        {
          headers: {
            ...h,
            "X-Org-Id": context.orgId,
            "X-User-Id": context.userId,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`Gateway getAuthorizeUrl failed: ${response.status}`);
      }
      return response.json() as Promise<{ url: string; state: string }>;
    },
  };
}

export type GatewayClient = ReturnType<typeof createGatewayClient>;
