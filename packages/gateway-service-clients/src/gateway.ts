import {
  type EndpointKey,
  type ProviderKey,
  type ProxyExecuteResponse,
  proxyExecuteResponseSchema,
  type ResponseDataFor,
  type TypedProxyRequest,
} from "@repo/console-providers";
import {
  type BackfillRunReadRecord,
  type BackfillRunRecord,
  backfillRunReadRecord,
  type GatewayConnection,
  type GatewayTokenResult,
  gatewayConnectionSchema,
  gatewayTokenResultSchema,
  type ProxyEndpointsResponse,
  proxyEndpointsResponseSchema,
} from "@repo/console-providers/contracts";
import { z } from "zod";

import { HttpError } from "./errors";
import type { ServiceClientConfig } from "./headers";
import { buildServiceHeaders } from "./headers";
import { gatewayUrl } from "./urls";

// ── Typed executeApi overloads ────────────────────────────────────────────────
// Object literal methods don't support TypeScript overload declarations, so we
// describe the two call signatures via a call-signature object type and cast.
// The narrow overload's data type is a compile-time assertion — the runtime
// still validates through proxyExecuteResponseSchema (data: unknown).
interface ExecuteApiFn {
  /** Narrow overload: statically known provider + endpoint → typed data. */
  <P extends ProviderKey, E extends EndpointKey<P>>(
    installationId: string,
    request: TypedProxyRequest<P, E>
  ): Promise<{
    status: number;
    data: ResponseDataFor<P, E>;
    headers: Record<string, string>;
  }>;
  /** Wide overload: runtime-dynamic → data: unknown (existing behaviour). */
  (
    installationId: string,
    request: {
      endpointId: string;
      pathParams?: Record<string, string>;
      queryParams?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<ProxyExecuteResponse>;
}

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
      const response = await fetch(`${gatewayUrl}/${installationId}`, {
        headers: h,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(
          `Gateway getConnection failed: ${response.status} for ${installationId}`
        );
      }
      const data = await response.json();
      return gatewayConnectionSchema.parse(data);
    },

    async getToken(installationId: string): Promise<GatewayTokenResult> {
      const response = await fetch(`${gatewayUrl}/${installationId}/token`, {
        headers: h,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(
          `Gateway getToken failed: ${response.status} for ${installationId}`
        );
      }
      const data = await response.json();
      return gatewayTokenResultSchema.parse(data);
    },

    async getBackfillRuns(
      installationId: string,
      status?: string
    ): Promise<BackfillRunReadRecord[]> {
      const url = `${gatewayUrl}/${installationId}/backfill-runs${status ? `?status=${status}` : ""}`;
      const response = await fetch(url, {
        headers: h,
        signal: AbortSignal.timeout(10_000),
      }).catch((err) => {
        console.warn("[gateway-client] getBackfillRuns failed", err);
        return null;
      });

      if (!response?.ok) {
        return [];
      }
      const data = await response.json();
      return z.array(backfillRunReadRecord).parse(data);
    },

    async upsertBackfillRun(
      installationId: string,
      record: BackfillRunRecord
    ): Promise<void> {
      await fetch(`${gatewayUrl}/${installationId}/backfill-runs`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {
        /* best-effort */
      });
    },

    executeApi: (async (
      installationId: string,
      request: {
        endpointId: string;
        pathParams?: Record<string, string>;
        queryParams?: Record<string, string>;
        body?: unknown;
      }
    ): Promise<ProxyExecuteResponse> => {
      const response = await fetch(
        `${gatewayUrl}/${installationId}/proxy/execute`,
        {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(60_000),
        }
      );
      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.error(
          `[executeApi] ${response.status} for ${installationId}: ${errBody}`
        );
        throw new HttpError(
          `Gateway executeApi failed: ${response.status} for ${installationId}`,
          response.status
        );
      }
      const data = await response.json();
      return proxyExecuteResponseSchema.parse(data);
    }) as unknown as ExecuteApiFn,

    async getApiEndpoints(
      installationId: string
    ): Promise<ProxyEndpointsResponse> {
      const response = await fetch(
        `${gatewayUrl}/${installationId}/proxy/endpoints`,
        { headers: h, signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) {
        throw new Error(
          `Gateway getApiEndpoints failed: ${response.status} for ${installationId}`
        );
      }
      const data = await response.json();
      return proxyEndpointsResponseSchema.parse(data);
    },

    async registerResource(
      installationId: string,
      resource: { providerResourceId: string; resourceName?: string }
    ): Promise<void> {
      const response = await fetch(
        `${gatewayUrl}/${installationId}/resources`,
        {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify(resource),
          signal: AbortSignal.timeout(10_000),
        }
      );
      // 409 = already registered — treat as success (idempotent)
      if (!response.ok && response.status !== 409) {
        throw new Error(
          `Gateway registerResource failed: ${response.status} for ${installationId}/${resource.providerResourceId}`
        );
      }
    },

    /**
     * Get OAuth authorize URL from the gateway.
     * Console-specific: requires orgId and userId context headers.
     */
    async getAuthorizeUrl(
      provider: string,
      context: { orgId: string; userId: string; redirectTo?: string }
    ): Promise<{ url: string; state: string }> {
      const qs = context.redirectTo ? `?redirect_to=${context.redirectTo}` : "";
      const response = await fetch(`${gatewayUrl}/${provider}/authorize${qs}`, {
        headers: {
          ...h,
          "X-Org-Id": context.orgId,
          "X-User-Id": context.userId,
        },
      });
      if (!response.ok) {
        throw new Error(`Gateway getAuthorizeUrl failed: ${response.status}`);
      }
      const data = await response.json();
      return z.object({ url: z.string(), state: z.string() }).parse(data);
    },
  };
}

export type GatewayClient = ReturnType<typeof createGatewayClient>;
