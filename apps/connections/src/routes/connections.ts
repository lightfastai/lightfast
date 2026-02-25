import { and, eq, sql } from "drizzle-orm";
import { gwInstallations, gwResources } from "@db/console/schema";
import { db } from "@db/console/client";
import { Hono } from "hono";
import { nanoid } from "@repo/lib";
import type { TenantVariables } from "../middleware/tenant";
import { tenantMiddleware } from "../middleware/tenant";
import { apiKeyAuth } from "../middleware/auth";
import { oauthStateKey, resourceKey } from "../lib/cache";
import { redis } from "@vendor/upstash";
import { connectionsBaseUrl, consoleUrl } from "../lib/urls";
import { getWorkflowClient } from "@vendor/upstash-workflow/client";

const workflowClient = getWorkflowClient();
import { getProvider } from "../providers";
import type { ProviderName } from "../providers/types";

const connections = new Hono<{ Variables: TenantVariables }>();

// ── OAuth ──

/**
 * GET /connections/:provider/authorize
 *
 * Initiate OAuth flow. Generates state token, stores in Redis, returns
 * authorization URL for the provider.
 */
connections.get("/:provider/authorize", tenantMiddleware, async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const orgId = c.get("orgId");

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  const state = nanoid();
  const connectedBy = c.req.header("X-User-Id") ?? "unknown";

  // Store OAuth state in Redis (10-minute TTL)
  await redis.hset(oauthStateKey(state), {
    provider: provider.name,
    orgId,
    connectedBy,
    createdAt: Date.now().toString(),
  });
  await redis.expire(oauthStateKey(state), 600);

  const url = provider.getAuthorizationUrl(state);

  return c.json({ url, state });
});

/**
 * Validate and consume OAuth state from Redis.
 * Returns stateData if valid, null if missing or expired.
 */
async function resolveAndConsumeState(
  c: { req: { query(key: string): string | undefined } },
): Promise<Record<string, string> | null> {
  const state = c.req.query("state");
  if (!state) return null;

  const stateData = await redis.hgetall<Record<string, string>>(oauthStateKey(state));
  if (!stateData?.orgId) return null;

  await redis.del(oauthStateKey(state));
  return stateData;
}

/**
 * GET /connections/:provider/callback
 *
 * OAuth callback. Validates state, dispatches to provider.
 */
connections.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  const stateData = await resolveAndConsumeState(c);
  if (!stateData) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  // For standard OAuth providers, validate provider matches state
  if (provider.name !== "github" && stateData.provider !== provider.name) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  try {
    await provider.handleCallback(c, stateData);
    return c.redirect(`${consoleUrl}/${provider.name}/connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return c.redirect(
      `${consoleUrl}/${provider.name}/connected?error=${encodeURIComponent(message)}`,
    );
  }
});

// ── Lifecycle ──

/**
 * GET /connections/:id
 *
 * Get connection details. Requires X-API-Key authentication.
 */
connections.get("/:id", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installation = await db.query.gwInstallations.findFirst({
    where: eq(gwInstallations.id, id),
    with: {
      tokens: {
        columns: {
          id: true,
          expiresAt: true,
          tokenType: true,
          scope: true,
          updatedAt: true,
        },
      },
      resources: { where: eq(gwResources.status, "active") },
    },
  });

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({
    id: installation.id,
    provider: installation.provider,
    externalId: installation.externalId,
    accountLogin: installation.accountLogin,
    orgId: installation.orgId,
    status: installation.status,
    hasToken:
      installation.provider === "github"
        ? true
        : installation.tokens.length > 0,
    tokenExpiresAt: installation.tokens[0]?.expiresAt ?? null,
    resources: installation.resources.map((r) => ({
      id: r.id,
      providerResourceId: r.providerResourceId,
      resourceName: r.resourceName,
    })),
    createdAt: installation.createdAt,
    updatedAt: installation.updatedAt,
  });
});

/**
 * GET /connections/:id/token
 *
 * Token vault — returns decrypted provider token for a connection.
 * Requires X-API-Key authentication.
 */
connections.get("/:id/token", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installationRows = await db
    .select()
    .from(gwInstallations)
    .where(eq(gwInstallations.id, id))
    .limit(1);

  const installation = installationRows[0];

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    return c.json(
      { error: "installation_not_active", status: installation.status },
      400,
    );
  }

  const provider = getProvider(installation.provider as ProviderName);

  try {
    const result = await provider.resolveToken(installation);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "no_token_found") {
      return c.json({ error: "no_token_found" }, 404);
    }
    if (message === "token_expired" || message === "token_expired:no_refresh_token") {
      return c.json({ error: "token_expired", message }, 401);
    }
    return c.json({ error: "token_generation_failed", message }, 502);
  }
});

/**
 * DELETE /connections/:provider/:id
 *
 * Teardown a connection. Triggers a durable workflow and returns immediately.
 * Requires X-API-Key authentication.
 */
connections.delete("/:provider/:id", apiKeyAuth, async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const id = c.req.param("id");

  const installationRows = await db
    .select()
    .from(gwInstallations)
    .where(and(eq(gwInstallations.id, id), eq(gwInstallations.provider, providerName)))
    .limit(1);

  const installation = installationRows[0];

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  // Trigger durable teardown workflow
  await workflowClient.trigger({
    url: `${connectionsBaseUrl}/workflows/connection-teardown`,
    body: {
      installationId: id,
      provider: providerName,
      orgId: installation.orgId,
    },
  });

  return c.json({ status: "teardown_initiated", installationId: id });
});

// ── Resources ──

/**
 * POST /connections/:id/resources
 *
 * Link a resource to a connection. Requires X-API-Key authentication.
 */
connections.post("/:id/resources", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installationRows = await db
    .select()
    .from(gwInstallations)
    .where(eq(gwInstallations.id, id))
    .limit(1);

  const installation = installationRows[0];

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    return c.json(
      { error: "installation_not_active", status: installation.status },
      400,
    );
  }

  const body = await c.req.json<{
    providerResourceId: string;
    resourceName?: string;
  }>();

  if (!body.providerResourceId) {
    return c.json({ error: "missing_provider_resource_id" }, 400);
  }

  const existingRows = await db
    .select({ id: gwResources.id })
    .from(gwResources)
    .where(
      and(
        eq(gwResources.installationId, id),
        eq(gwResources.providerResourceId, body.providerResourceId),
        eq(gwResources.status, "active"),
      ),
    )
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    return c.json(
      { error: "resource_already_linked", resourceId: existing.id },
      409,
    );
  }

  const resourceRows = await db
    .insert(gwResources)
    .values({
      installationId: id,
      providerResourceId: body.providerResourceId,
      resourceName: body.resourceName,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [gwResources.installationId, gwResources.providerResourceId],
      set: {
        status: "active",
        resourceName: body.resourceName,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning();

  const resource = resourceRows[0];
  if (!resource) return c.json({ error: "insert_failed" }, 500);

  // Populate Redis routing cache
  await redis.hset(
    resourceKey(installation.provider as ProviderName, body.providerResourceId),
    { connectionId: id, orgId: installation.orgId },
  );

  return c.json({
    status: "linked",
    resource: {
      id: resource.id,
      providerResourceId: resource.providerResourceId,
      resourceName: resource.resourceName,
    },
  });
});

/**
 * DELETE /connections/:id/resources/:resourceId
 *
 * Unlink a resource from a connection. Requires X-API-Key authentication.
 */
connections.delete("/:id/resources/:resourceId", apiKeyAuth, async (c) => {
  const id = c.req.param("id");
  const resourceId = c.req.param("resourceId");

  const resourceRows = await db
    .select()
    .from(gwResources)
    .where(and(eq(gwResources.id, resourceId), eq(gwResources.installationId, id)))
    .limit(1);

  const resource = resourceRows[0];

  if (!resource) {
    return c.json({ error: "not_found" }, 404);
  }

  if (resource.status === "removed") {
    return c.json({ error: "already_removed" }, 400);
  }

  await db
    .update(gwResources)
    .set({ status: "removed" })
    .where(eq(gwResources.id, resourceId));

  const installationRows = await db
    .select({ provider: gwInstallations.provider })
    .from(gwInstallations)
    .where(eq(gwInstallations.id, id))
    .limit(1);

  const installation = installationRows[0];

  if (installation) {
    await redis.del(
      resourceKey(installation.provider as ProviderName, resource.providerResourceId),
    );
  }

  return c.json({ status: "removed", resourceId });
});

export { connections };
