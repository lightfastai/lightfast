import { db } from "@db/app/client";
import { gatewayInstallations } from "@db/app/schema";
import { getProvider } from "@repo/app-providers";
import type {
  ProxyExecuteRequest,
  ProxyExecuteResponse,
  ProxySearchResponse,
} from "@repo/app-validation/api";
import { createMemoryCaller } from "@repo/platform-trpc/caller";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import type { AuthContext } from "./types";

/**
 * Extract path parameter names from a URL template.
 * E.g., "/repos/{owner}/{repo}" → ["owner", "repo"]
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g);
  if (!matches) {
    return [];
  }
  return matches.map((m) => m.slice(1, -1));
}

export async function proxySearchLogic(
  auth: AuthContext,
  requestId: string
): Promise<ProxySearchResponse> {
  const installations = await db
    .select()
    .from(gatewayInstallations)
    .where(
      and(
        eq(gatewayInstallations.orgId, auth.clerkOrgId),
        eq(gatewayInstallations.status, "active")
      )
    );

  const connections = installations
    .map((inst) => {
      const providerDef = getProvider(inst.provider);
      if (!providerDef) {
        return null;
      }

      const endpoints = Object.entries(providerDef.api.endpoints).map(
        ([key, ep]) => {
          const pathParams = extractPathParams(ep.path);
          return {
            endpointId: key,
            method: ep.method as "GET" | "POST",
            path: ep.path,
            description: ep.description,
            ...(pathParams.length > 0 ? { pathParams } : {}),
            ...(ep.timeout ? { timeout: ep.timeout } : {}),
          };
        }
      );

      return {
        installationId: inst.id,
        provider: inst.provider,
        status: inst.status,
        baseUrl: providerDef.api.baseUrl,
        endpoints,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  log.info("Proxy search complete", {
    requestId,
    connectionCount: connections.length,
  });

  return { connections };
}

export async function proxyExecuteLogic(
  auth: AuthContext,
  request: ProxyExecuteRequest,
  requestId: string
): Promise<ProxyExecuteResponse> {
  // Verify the installation belongs to the user's org
  const installation = await db.query.gatewayInstallations.findFirst({
    where: and(
      eq(gatewayInstallations.id, request.installationId),
      eq(gatewayInstallations.orgId, auth.clerkOrgId)
    ),
  });

  if (!installation) {
    throw new Error("Installation not found or access denied");
  }

  if (installation.status !== "active") {
    throw new Error(`Installation not active (status: ${installation.status})`);
  }

  const memory = await createMemoryCaller();
  const result = await memory.proxy.execute({
    installationId: request.installationId,
    endpointId: request.endpointId,
    pathParams: request.pathParams,
    queryParams: request.queryParams,
    body: request.body,
  });

  log.info("Proxy execute complete", {
    requestId,
    installationId: request.installationId,
    endpointId: request.endpointId,
    status: result.status,
  });

  return {
    status: result.status,
    data: result.data,
    headers: result.headers,
  };
}
