import { db } from "@db/app/client";
import { gatewayInstallations, orgIntegrations } from "@db/app/schema";
import { getProvider, type SourceType } from "@repo/app-providers";
import type {
  ProxyCall,
  ProxyCallResponse,
  ProxySearchResponse,
} from "@repo/app-validation/api";
import { createPlatformCaller } from "@repo/platform-trpc/caller";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import type { AuthContext } from "./types";

const CONN_PREFIX = "conn_";

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

export async function proxySearchLogic(
  auth: AuthContext
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

  // Create caller once — it's stateless w.r.t. installations.
  // installationId is passed as procedure input at call time.
  const platform = await createPlatformCaller();

  const connections = await Promise.all(
    installations.map(async (inst) => {
      // Cast to string to use the wide getProvider overload — avoids
      // union-of-function parameter intersection issues with TAccountInfo.
      const providerDef = getProvider(inst.provider as string);
      if (!providerDef) {
        return null;
      }

      // Query connected resources for this installation
      const integrations = await db
        .select()
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.installationId, inst.id),
            eq(orgIntegrations.status, "active")
          )
        );

      // Build executeApi callback for this installation
      const executeApi = async (req: {
        endpointId: string;
        pathParams?: Record<string, string>;
        queryParams?: Record<string, string>;
        body?: unknown;
      }) =>
        platform.proxy.execute({
          installationId: inst.id,
          endpointId: req.endpointId,
          pathParams: req.pathParams,
          queryParams: req.queryParams,
          body: req.body,
        });

      // Resolve all resources (1 batch API call per provider)
      // On failure, fall back to using providerResourceId as the display name
      // so connected resources still appear (with opaque IDs instead of names).
      let resolvedResources: Awaited<
        ReturnType<typeof providerDef.resourcePicker.resolveProxyResources>
      > = [];
      try {
        resolvedResources =
          await providerDef.resourcePicker.resolveProxyResources(executeApi, {
            id: inst.id,
            externalId: inst.externalId,
            providerAccountInfo: inst.providerAccountInfo!,
          });
      } catch (err) {
        log.warn("Failed to resolve proxy resources, falling back to IDs", {
          provider: inst.provider,
          error: parseError(err),
        });
        // Degraded mode: use orgIntegrations data directly so resources
        // still appear with providerResourceId as name and empty params.
        resolvedResources = integrations.map((i) => ({
          providerResourceId: i.providerResourceId,
          name: i.providerResourceId,
          params: {},
        }));
      }

      // Build a lookup set of connected providerResourceIds
      const connectedSet = new Map(
        integrations.map((i) => [i.providerResourceId, i])
      );

      // Filter to connected resources and merge sync events
      const resources = resolvedResources
        .filter((r) => connectedSet.has(r.providerResourceId))
        .map((r) => {
          const integration = connectedSet.get(r.providerResourceId);
          const config = integration?.providerConfig as {
            sync?: { events?: string[] };
          } | null;
          return {
            name: r.name,
            params: r.params,
            ...(config?.sync?.events?.length
              ? { syncing: config.sync.events }
              : {}),
          };
        });

      // Build action catalog from endpoint definitions
      const actions = Object.entries(providerDef.api.endpoints).map(
        ([key, ep]) => {
          const params = extractPathParams(ep.path);
          return {
            action: `${inst.provider}.${key}`,
            ...(params.length > 0 ? { params } : {}),
            description: ep.description,
          };
        }
      );

      return {
        id: `${CONN_PREFIX}${inst.id}`,
        provider: inst.provider,
        resources,
        actions,
      };
    })
  );

  const filtered = connections.filter(
    (c): c is NonNullable<typeof c> => c !== null
  );

  return { connections: filtered };
}

export async function proxyCallLogic(
  auth: AuthContext,
  request: ProxyCall
): Promise<ProxyCallResponse> {
  // Parse action → provider + endpointId
  const dotIndex = request.action.indexOf(".");
  if (dotIndex === -1) {
    throw new Error(
      `Invalid action format: "${request.action}". Expected "provider.endpointId"`
    );
  }
  const providerName = request.action.slice(0, dotIndex);
  const endpointId = request.action.slice(dotIndex + 1);

  // Resolve installation
  let installationId: string;

  if (request.connection) {
    // Validate provided connection
    installationId = request.connection.startsWith(CONN_PREFIX)
      ? request.connection.slice(CONN_PREFIX.length)
      : request.connection;

    const installation = await db.query.gatewayInstallations.findFirst({
      where: and(
        eq(gatewayInstallations.id, installationId),
        eq(gatewayInstallations.orgId, auth.clerkOrgId)
      ),
    });

    if (!installation) {
      throw new Error("Connection not found or access denied");
    }
    if (installation.status !== "active") {
      throw new Error(`Connection not active (status: ${installation.status})`);
    }
    if (installation.provider !== providerName) {
      throw new Error(
        `Connection provider mismatch: expected ${providerName}, got ${installation.provider}`
      );
    }
  } else {
    // Auto-resolve: find single active installation for this provider
    const installations = await db
      .select()
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.orgId, auth.clerkOrgId),
          eq(gatewayInstallations.provider, providerName as SourceType),
          eq(gatewayInstallations.status, "active")
        )
      );

    if (installations.length === 0) {
      throw new Error(`Provider "${providerName}" is not connected`);
    }
    installationId = installations[0]!.id;
  }

  // Validate endpoint exists
  const providerDef = getProvider(providerName);
  if (!providerDef) {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  const endpoint = providerDef.api.endpoints[endpointId];
  if (!endpoint) {
    throw new Error(
      `Unknown action: ${request.action}. Available: ${Object.keys(
        providerDef.api.endpoints
      )
        .map((k) => `${providerName}.${k}`)
        .join(", ")}`
    );
  }

  // Route flat params → pathParams / queryParams / body
  const pathParamNames = new Set(extractPathParams(endpoint.path));
  const flatParams = (request.params ?? {}) as Record<string, unknown>;

  const pathParams: Record<string, string> = {};
  const remaining: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flatParams)) {
    if (pathParamNames.has(key)) {
      pathParams[key] = String(value);
    } else {
      remaining[key] = value;
    }
  }

  let queryParams: Record<string, string> | undefined;
  let body: unknown | undefined;

  const hasRemaining = Object.keys(remaining).length > 0;

  if (endpoint.method === "GET" && hasRemaining) {
    // GET: remaining → query params
    queryParams = {};
    for (const [key, value] of Object.entries(remaining)) {
      queryParams[key] = String(value);
    }
  } else if (hasRemaining) {
    // POST: remaining → body
    body = remaining;
  }

  // Execute via platform proxy
  const platform = await createPlatformCaller();
  const result = await platform.proxy.execute({
    installationId,
    endpointId,
    pathParams: Object.keys(pathParams).length > 0 ? pathParams : undefined,
    queryParams,
    body,
  });

  return {
    status: result.status,
    data: result.data,
    headers: result.headers,
  };
}
