/**
 * Proxy tRPC sub-router.
 *
 * Ported from apps/gateway/src/routes/connections.ts (proxy endpoints).
 * All procedures use serviceProcedure (JWT auth required).
 *
 * listEndpoints: Returns the provider's API catalog (strips Zod responseSchema).
 * execute: Pure authenticated API proxy with 401-retry pattern.
 */
import { db } from "@db/app/client";
import { gatewayInstallations } from "@db/app/schema";
import type { ProviderApi, ProviderDefinition } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { eq } from "@vendor/db";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import { providerConfigs } from "../../lib/provider-configs";
import {
  forceRefreshToken,
  getActiveTokenForInstallation,
} from "../../lib/token-helpers";
import { serviceProcedure } from "../../trpc";

// ── Proxy Router ────────────────────────────────────────────────────────────

export const proxyRouter = {
  /**
   * List available API endpoints for a connection's provider.
   * Source: GET /connections/:id/proxy/endpoints
   *
   * Strips responseSchema (Zod types are not JSON-serializable).
   */
  listEndpoints: serviceProcedure
    .input(
      z.object({
        installationId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const installation = await db.query.gatewayInstallations.findFirst({
        where: eq(gatewayInstallations.id, input.installationId),
      });

      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      const providerDef = getProvider(installation.provider);
      if (!providerDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown provider",
        });
      }

      // Strip responseSchema (Zod types are not serializable)
      const endpoints: Record<
        string,
        { method: string; path: string; description: string; timeout?: number }
      > = {};
      for (const [key, ep] of Object.entries(providerDef.api.endpoints)) {
        endpoints[key] = {
          method: ep.method,
          path: ep.path,
          description: ep.description,
          ...(ep.timeout ? { timeout: ep.timeout } : {}),
        };
      }

      return {
        provider: installation.provider,
        baseUrl: providerDef.api.baseUrl,
        endpoints,
      };
    }),

  /**
   * Pure authenticated API proxy. Zero domain knowledge.
   * Source: POST /connections/:id/proxy/execute
   *
   * Handles: endpoint validation, auth injection, 401 retry.
   * Returns: raw { status, data, headers }.
   */
  execute: serviceProcedure
    .input(
      z.object({
        installationId: z.string(),
        endpointId: z.string().min(1),
        pathParams: z.record(z.string(), z.string()).optional(),
        queryParams: z.record(z.string(), z.string()).optional(),
        body: z.unknown().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const installation = await db.query.gatewayInstallations.findFirst({
        where: eq(gatewayInstallations.id, input.installationId),
      });

      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (installation.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Installation not active (status: ${installation.status})`,
        });
      }

      const providerName = installation.provider;
      const providerDef = getProvider(providerName);
      if (!providerDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown provider",
        });
      }

      const config = providerConfigs[providerName];

      // Widen to base ProviderApi for runtime-dynamic endpoint/header access.
      // Each provider's TApi satisfies ProviderApi -- structural widening, not a cast.
      const api: ProviderApi = providerDef.api;

      // Validate endpoint exists in catalog
      const endpoint = api.endpoints[input.endpointId];
      if (!endpoint) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown endpoint: ${input.endpointId}. Available: ${Object.keys(api.endpoints).join(", ")}`,
        });
      }

      // Get active token.
      // If the endpoint declares its own buildAuth, use it (e.g. GitHub App JWT for
      // app-level endpoints). Otherwise fall through to the default per-installation token flow.
      let token: string;
      try {
        if (endpoint.buildAuth) {
          token = await endpoint.buildAuth(config);
        } else {
          // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
          // but the helper takes the base ProviderDefinition. The generic parameters are
          // erased at runtime -- the cast is safe because the concrete type is a supertype.
          ({ token } = await getActiveTokenForInstallation(
            installation,
            config,
            providerDef as ProviderDefinition
          ));
        }
      } catch (err) {
        const message = parseError(err);
        log.error("[proxy] token acquisition failed", {
          installationId: input.installationId,
          provider: providerName,
          error: message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `token_error: ${message}`,
        });
      }

      // Build URL
      let path = endpoint.path;
      if (input.pathParams) {
        for (const [key, val] of Object.entries(input.pathParams)) {
          path = path.replace(`{${key}}`, encodeURIComponent(val));
        }
      }

      let url = `${api.baseUrl}${path}`;
      if (input.queryParams && Object.keys(input.queryParams).length > 0) {
        url += `?${new URLSearchParams(input.queryParams).toString()}`;
      }

      // Build headers
      const authHeader = api.buildAuthHeader
        ? api.buildAuthHeader(token)
        : `Bearer ${token}`;

      const headers: Record<string, string> = {
        Authorization: authHeader,
        ...(api.defaultHeaders ?? {}),
      };

      // Build fetch options
      const fetchOptions: RequestInit = {
        method: endpoint.method,
        headers,
        signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
      };

      if (input.body) {
        fetchOptions.body = JSON.stringify(input.body);
        headers["Content-Type"] = "application/json";
      }

      // Execute with 401 retry
      let response = await fetch(url, fetchOptions);

      if (response.status === 401) {
        let freshToken: string | null = null;
        if (endpoint.buildAuth) {
          try {
            freshToken = await endpoint.buildAuth(config);
          } catch (retryErr) {
            log.warn("[proxy] auth rebuild failed during 401 retry", {
              installationId: input.installationId,
              provider: providerName,
              endpointId: input.endpointId,
              error: parseError(retryErr),
            });
            // fall through without retry
          }
        } else {
          // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
          // but the helper takes the base ProviderDefinition. The generic parameters are
          // erased at runtime -- the cast is safe because the concrete type is a supertype.
          freshToken = await forceRefreshToken(
            installation,
            config,
            providerDef as ProviderDefinition
          );
        }
        if (freshToken && freshToken !== token) {
          headers.Authorization = api.buildAuthHeader
            ? api.buildAuthHeader(freshToken)
            : `Bearer ${freshToken}`;
          response = await fetch(url, { ...fetchOptions, headers });
        }
      }

      // Return raw response -- no parsing, no transformation
      const data = await response.json().catch((parseErr: unknown) => {
        log.warn("[proxy] response body parse failed", {
          installationId: input.installationId,
          provider: providerName,
          endpointId: input.endpointId,
          status: response.status,
          error: parseError(parseErr),
        });
        return null;
      });
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        data,
        headers: responseHeaders,
      };
    }),
} satisfies TRPCRouterRecord;
