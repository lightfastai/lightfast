import type { BackfillRunRecord } from "@repo/gateway-types";

import { env } from "../env.js";
import { gatewayUrl } from "./related-projects.js";

export interface Connection {
  id: string;
  provider: string;
  externalId: string;
  orgId: string;
  status: string;
  resources: {
    id: string;
    providerResourceId: string;
    resourceName: string | null;
  }[];
}

export interface TokenResult {
  accessToken: string;
  provider: string;
  expiresIn: number | null;
}

function headers(correlationId?: string) {
  return {
    "X-API-Key": env.GATEWAY_API_KEY,
    "X-Request-Source": "backfill",
    ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
  };
}

export function createGatewayClient(opts: { correlationId?: string } = {}) {
  const h = headers(opts.correlationId);

  return {
    async getConnection(installationId: string): Promise<Connection> {
      const response = await fetch(
        `${gatewayUrl}/gateway/${installationId}`,
        { headers: h, signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) {
        throw new Error(`Gateway getConnection failed: ${response.status} for ${installationId}`);
      }
      return response.json() as Promise<Connection>;
    },

    async getToken(installationId: string): Promise<TokenResult> {
      const response = await fetch(
        `${gatewayUrl}/gateway/${installationId}/token`,
        { headers: h, signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) {
        throw new Error(`Gateway getToken failed: ${response.status} for ${installationId}`);
      }
      return response.json() as Promise<TokenResult>;
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
      }).catch(() => {}); // Best-effort
    },
  };
}

export type GatewayClient = ReturnType<typeof createGatewayClient>;
