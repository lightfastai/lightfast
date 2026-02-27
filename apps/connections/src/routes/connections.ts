import { db } from "@db/console/client";
import { gwInstallations, gwResources } from "@db/console/schema";
import { nanoid } from "@repo/lib";
import { redis } from "@vendor/upstash";
import { getWorkflowClient } from "@vendor/upstash-workflow/client";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { html, raw } from "hono/html";
import { oauthResultKey, oauthStateKey, resourceKey } from "../lib/cache.js";
import { connectionsBaseUrl, consoleUrl } from "../lib/urls.js";
import { apiKeyAuth } from "../middleware/auth.js";
import type { TenantVariables } from "../middleware/tenant.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import { getProvider } from "../providers/index.js";
import type { ProviderName } from "../providers/types.js";

const workflowClient = getWorkflowClient();

const connections = new Hono<{ Variables: TenantVariables }>();

// ── OAuth ──

/**
 * GET /connections/:provider/authorize
 *
 * Initiate OAuth flow. Requires X-API-Key authentication (service-to-service only).
 * Generates state token, stores in Redis, returns authorization URL for the provider.
 * Accepts optional `redirect_to` query param for CLI/non-browser clients.
 */
connections.get("/:provider/authorize", apiKeyAuth, tenantMiddleware, async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const orgId = c.get("orgId");

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  // Validate redirect_to — allowlist: "inline", localhost, or consoleUrl
  const redirectTo = c.req.query("redirect_to");
  if (redirectTo && redirectTo !== "inline") {
    try {
      const url = new URL(redirectTo);
      if (url.hostname !== "localhost" && !redirectTo.startsWith(consoleUrl)) {
        return c.json({ error: "invalid_redirect_to" }, 400);
      }
    } catch {
      return c.json({ error: "invalid_redirect_to" }, 400);
    }
  }

  const state = nanoid();
  const connectedBy = c.req.header("X-User-Id") ?? "unknown";

  // Store OAuth state in Redis (10-minute TTL) — atomic pipeline
  const key = oauthStateKey(state);
  await redis
    .pipeline()
    .hset(key, {
      provider: provider.name,
      orgId,
      connectedBy,
      ...(redirectTo ? { redirectTo } : {}),
      createdAt: Date.now().toString(),
    })
    .expire(key, 600)
    .exec();

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
  if (!state) {return null;}

  const stateData = await redis.hgetall<Record<string, string>>(oauthStateKey(state));
  if (!stateData?.orgId) {return null;}

  await redis.del(oauthStateKey(state));
  return stateData;
}

/**
 * GET /connections/oauth/status
 *
 * Poll for OAuth completion. Used by CLI to detect when the browser
 * OAuth flow has completed. No auth required — the state token itself
 * is the secret (cryptographically random nanoid, known only to the initiator).
 *
 * IMPORTANT: Registered BEFORE /:provider/callback to prevent "oauth" matching as a provider.
 */
connections.get("/oauth/status", async (c) => {
  const state = c.req.query("state");

  if (!state) {
    return c.json({ error: "missing_state" }, 400);
  }

  const result = await redis.hgetall<Record<string, string>>(oauthResultKey(state));

  if (!result) {
    return c.json({ status: "pending" });
  }

  return c.json(result);
});

/**
 * GET /connections/:provider/callback
 *
 * OAuth callback. Validates state, dispatches to provider.
 * Supports UI-agnostic completion via redirectTo from state:
 *   - "inline": renders HTML for CLI (browser can be closed)
 *   - URL string: redirects to explicit URL (validated at authorize time)
 *   - undefined: default redirect to console (backwards compatible)
 */
connections.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const state = c.req.query("state") ?? "";

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

  if (stateData.provider !== provider.name) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  try {
    const result = await provider.handleCallback(c, stateData);

    // Store completion result in Redis for CLI polling (5-min TTL)
    await redis
      .pipeline()
      .hset(oauthResultKey(state), {
        status: "completed",
        provider: provider.name,
        ...(result.reactivated ? { reactivated: "true" } : {}),
        ...(result.setupAction ? { setupAction: result.setupAction } : {}),
      })
      .expire(oauthResultKey(state), 300)
      .exec();

    const redirectTo = stateData.redirectTo;

    if (redirectTo === "inline") {
      // CLI mode: render inline HTML — user can close the tab
      return await c.html(
        html`<!doctype html>
          <html>
            <head><title>Connected</title></head>
            <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa">
              <div style="text-align:center">
                <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
                <h1 style="margin:0 0 8px">Connected to ${provider.name}!</h1>
                <p style="color:#666">You can close this tab and return to your terminal.</p>
              </div>
              ${raw("<script>setTimeout(()=>window.close(),2000)</script>")}
            </body>
          </html>`,
      );
    }

    if (redirectTo) {
      // Explicit redirect URL (validated during authorize)
      const redirectUrl = new URL(redirectTo);
      if (result.reactivated) {
        redirectUrl.searchParams.set("reactivated", "true");
      }
      if (result.setupAction) {
        redirectUrl.searchParams.set("setup_action", result.setupAction);
      }
      return c.redirect(redirectUrl.toString());
    }

    // Default: redirect to console (existing behavior, backwards compatible)
    const redirectUrl = new URL(`${consoleUrl}/${provider.name}/connected`);
    if (result.reactivated) {
      redirectUrl.searchParams.set("reactivated", "true");
    }
    if (result.setupAction) {
      redirectUrl.searchParams.set("setup_action", result.setupAction);
    }
    return c.redirect(redirectUrl.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";

    // Store error result for CLI polling
    await redis
      .pipeline()
      .hset(oauthResultKey(state), {
        status: "failed",
        error: message,
      })
      .expire(oauthResultKey(state), 300)
      .exec();

    const redirectTo = stateData.redirectTo;

    if (redirectTo === "inline") {
      return c.html(
        html`<!doctype html>
          <html>
            <head><title>Connection Failed</title></head>
            <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa">
              <div style="text-align:center">
                <div style="font-size:48px;margin-bottom:16px">&#10007;</div>
                <h1 style="margin:0 0 8px">Connection Failed</h1>
                <p style="color:#666">${message}</p>
                <p style="color:#999;font-size:14px">Close this tab and try again in your terminal.</p>
              </div>
            </body>
          </html>`,
        400,
      );
    }

    if (redirectTo) {
      return c.redirect(
        `${redirectTo}?error=${encodeURIComponent(message)}`,
      );
    }

    return c.redirect(
      `${consoleUrl}/${provider.name}/connected?error=${encodeURIComponent(message)}`,
    );
  }
});

// ── Lifecycle ──
// INTERNAL-ONLY: These endpoints are called exclusively by trusted backend
// services (backfill orchestrator, entity worker) that hold GATEWAY_API_KEY.
// They are NOT reachable from external clients — the console's Next.js rewrite
// for /services/connections/* is blocked by both Clerk middleware and the
// absence of X-API-Key on proxied requests.
//
// No per-org scoping is applied here; callers are responsible for passing
// correct installationIds obtained through org-scoped flows. If these
// endpoints are ever exposed to less-trusted callers, add tenantMiddleware
// and an orgId WHERE clause.

/**
 * GET /connections/:id
 *
 * Get connection details. Internal-only, requires X-API-Key authentication.
 * Callers: backfill-orchestrator
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
    resources: installation.resources.map((r: (typeof installation.resources)[number]) => ({
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
 * Internal-only, requires X-API-Key authentication.
 * Callers: backfill entity-worker
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
 * Internal-only, requires X-API-Key authentication.
 * Callers: console tRPC (org/connections.disconnect)
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
    url: `${connectionsBaseUrl}/connections/workflows/connection-teardown`,
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
 * Link a resource to a connection. Internal-only, requires X-API-Key authentication.
 * Callers: console tRPC (org/connections, org/workspace)
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

  let body: { providerResourceId: string; resourceName?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

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
  if (!resource) {return c.json({ error: "insert_failed" }, 500);}

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
 * Unlink a resource from a connection. Internal-only, requires X-API-Key authentication.
 * Callers: console tRPC (org/connections, org/workspace)
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
