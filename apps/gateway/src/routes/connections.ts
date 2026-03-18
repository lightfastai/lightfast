import { db } from "@db/console/client";
import {
  gatewayBackfillRuns,
  gatewayInstallations,
  gatewayResources,
  gatewayTokens,
} from "@db/console/schema";
import type {
  ProviderDefinition,
  RuntimeConfig,
  SourceType,
} from "@repo/console-providers";
import {
  BACKFILL_TERMINAL_STATUSES,
  backfillRunRecord,
  getProvider,
  PROVIDERS,
} from "@repo/console-providers";
import { decrypt, nanoid } from "@repo/lib";
import { and, eq, sql } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { redis } from "@vendor/upstash";
import { workflowClient } from "@vendor/upstash-workflow/client";
import { Hono } from "hono";
import { html, raw } from "hono/html";
import { env } from "../env.js";
import { oauthResultKey, oauthStateKey, resourceKey } from "../lib/cache.js";
import { getEncryptionKey } from "../lib/encryption.js";
import { updateTokenRecord, writeTokenRecord } from "../lib/token-store.js";
import { consoleUrl, gatewayBaseUrl } from "../lib/urls.js";
import { apiKeyAuth } from "../middleware/auth.js";
import type { LifecycleVariables } from "../middleware/lifecycle.js";
import type { TenantVariables } from "../middleware/tenant.js";
import { tenantMiddleware } from "../middleware/tenant.js";

// ── Module-level provider configs ──
// Built once at startup from validated env vars via provider.createConfig().

const runtime: RuntimeConfig = { callbackBaseUrl: gatewayBaseUrl };

/** Configs keyed by provider name */
// SAFETY: env is validated by @t3-oss/env-core at startup; the gateway's combined
// env object is structurally compatible with Record<string, string> (all env vars
// are strings). The intersection type from createEnv() cannot be expressed generically.
// Optional providers return null from createConfig when their env vars are absent —
// they are excluded here and will return "unknown_provider" on any request.
const providerConfigs: Record<string, unknown> = Object.fromEntries(
  Object.entries(PROVIDERS)
    .map(
      ([name, p]) =>
        [
          name,
          p.createConfig(env as unknown as Record<string, string>, runtime),
        ] as const
    )
    .filter(([, config]) => config !== null)
);

const connections = new Hono<{
  Variables: TenantVariables & LifecycleVariables;
}>();

// ── OAuth ──

/**
 * GET /connections/:provider/authorize
 *
 * Initiate OAuth flow. Requires X-API-Key authentication (service-to-service only).
 * Generates state token, stores in Redis, returns authorization URL for the provider.
 * Accepts optional `redirect_to` query param for CLI/non-browser clients.
 */
connections.get(
  "/:provider/authorize",
  apiKeyAuth,
  tenantMiddleware,
  async (c) => {
    const providerName = c.req.param("provider") as SourceType;
    const orgId = c.get("orgId");

    const providerDef = getProvider(providerName);
    const config = providerConfigs[providerName];

    if (!config) {
      return c.json({ error: "unknown_provider", provider: providerName }, 400);
    }

    // Validate redirect_to — allowlist: "inline", localhost, or consoleUrl
    const redirectTo = c.req.query("redirect_to");
    if (redirectTo && redirectTo !== "inline") {
      try {
        const url = new URL(redirectTo);
        if (
          url.hostname !== "localhost" &&
          !redirectTo.startsWith(consoleUrl)
        ) {
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
        provider: providerName,
        orgId,
        connectedBy,
        ...(redirectTo ? { redirectTo } : {}),
        createdAt: Date.now().toString(),
      })
      .expire(key, 600)
      .exec();

    const auth = providerDef.auth;
    let url: string;
    if (auth.kind === "oauth") {
      // SAFETY: config is providerConfigs[providerName], created by the same provider's
      // createConfig(). Runtime type matches TConfig; the gateway cannot know TConfig
      // statically because it serves all providers from a single Record<string, unknown>.
      url = auth.buildAuthUrl(config as never, state);
    } else if (auth.kind === "app-token") {
      url = auth.buildInstallUrl(config as never, state);
    } else {
      return c.json({ error: "provider_does_not_support_oauth" }, 400);
    }

    return c.json({ url, state });
  }
);

/**
 * Validate and consume OAuth state from Redis.
 * Returns stateData if valid, null if missing or expired.
 */
async function resolveAndConsumeState(c: {
  req: { query(key: string): string | undefined };
}): Promise<Record<string, string> | null> {
  const state = c.req.query("state");
  if (!state) {
    return null;
  }

  // Atomic read-and-delete to prevent state replay via concurrent requests
  const key = oauthStateKey(state);
  const [stateData] = await redis
    .multi()
    .hgetall<Record<string, string>>(key)
    .del(key)
    .exec<[Record<string, string> | null, number]>();

  if (!stateData?.orgId) {
    return null;
  }

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

  const result = await redis.hgetall<Record<string, string>>(
    oauthResultKey(state)
  );

  if (!result) {
    return c.json({ status: "pending" });
  }

  return c.json(result);
});

/**
 * GET /connections/:provider/callback
 *
 * OAuth callback. Validates state, calls processCallback (pure provider logic),
 * then upserts the installation in DB.
 * Supports UI-agnostic completion via redirectTo from state:
 *   - "inline": renders HTML for CLI (browser can be closed)
 *   - URL string: redirects to explicit URL (validated at authorize time)
 *   - undefined: default redirect to console (backwards compatible)
 */
connections.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as SourceType;
  const state = c.req.query("state") ?? "";

  const providerDef = getProvider(providerName);
  const config = providerConfigs[providerName];

  if (!config) {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  let stateData = await resolveAndConsumeState(c);

  // GitHub-initiated redirects (permission changes, reinstalls) arrive without
  // our state token. If state is missing but installation_id is present, look up
  // the existing installation to recover orgId/connectedBy.
  if (!stateData && providerName === "github") {
    const installationId = c.req.query("installation_id");
    if (installationId) {
      const existing = await db
        .select({
          orgId: gatewayInstallations.orgId,
          connectedBy: gatewayInstallations.connectedBy,
        })
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.provider, "github"),
            eq(gatewayInstallations.externalId, installationId)
          )
        )
        .limit(1);

      const row = existing[0];
      if (row) {
        stateData = {
          provider: "github",
          orgId: row.orgId,
          connectedBy: row.connectedBy,
        };
      }
    }
  }

  if (!stateData) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  if (stateData.provider !== providerName) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  const orgId = stateData.orgId ?? "";
  const connectedBy = stateData.connectedBy ?? "unknown";

  try {
    // Build query dict from all URL search params
    const query: Record<string, string> = {};
    const url = new URL(c.req.url);
    for (const [k, v] of url.searchParams) {
      query[k] = v;
    }

    const auth = providerDef.auth;
    if (auth.kind !== "oauth" && auth.kind !== "app-token") {
      return c.json({ error: "provider_does_not_support_oauth" }, 400);
    }

    // Pure provider logic — no DB, no Hono coupling.
    // Both OAuthDef and AppTokenDef have processCallback — TypeScript narrows here.
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the gateway cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    const result = await auth.processCallback(config as never, query);

    // Handle pending-setup: provider needs additional configuration (e.g., GitHub App request flow).
    // No installation to upsert — just store the setup action and redirect.
    if (result.status === "pending-setup") {
      await redis
        .pipeline()
        .hset(oauthResultKey(state), {
          status: "completed",
          provider: providerName,
          setupAction: result.setupAction,
        })
        .expire(oauthResultKey(state), 300)
        .exec();

      const redirectTo = stateData.redirectTo;

      if (redirectTo === "inline") {
        return await c.html(
          html`<!doctype html>
            <html>
              <head><title>Connected</title></head>
              <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa">
                <div style="text-align:center">
                  <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
                  <h1 style="margin:0 0 8px">Connected to ${providerName}!</h1>
                  <p style="color:#666">You can close this tab and return to your terminal.</p>
                </div>
                ${raw("<script>setTimeout(()=>window.close(),2000)</script>")}
              </body>
            </html>`
        );
      }

      if (redirectTo) {
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set("setup_action", result.setupAction);
        return c.redirect(redirectUrl.toString());
      }

      const setupUrl = new URL(
        `${consoleUrl}/provider/${providerName}/connected`
      );
      setupUrl.searchParams.set("setup_action", result.setupAction);
      return c.redirect(setupUrl.toString());
    }

    // For all connected statuses: detect reactivation and upsert installation
    const existingRows = await db
      .select({ id: gatewayInstallations.id })
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.provider, providerName),
          eq(gatewayInstallations.externalId, result.externalId)
        )
      )
      .limit(1);

    const reactivated = existingRows.length > 0;

    // Upsert installation — idempotent on (provider, externalId)
    const rows = await db
      .insert(gatewayInstallations)
      .values({
        provider: providerName,
        externalId: result.externalId,
        connectedBy,
        orgId,
        status: "active",
        providerAccountInfo: result.accountInfo,
      })
      .onConflictDoUpdate({
        target: [
          gatewayInstallations.provider,
          gatewayInstallations.externalId,
        ],
        set: {
          status: "active",
          connectedBy,
          orgId,
          providerAccountInfo: result.accountInfo,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({ id: gatewayInstallations.id });

    const installation = rows[0];
    if (!installation) {
      throw new Error("upsert_failed");
    }

    // Persist OAuth tokens for statuses that include them
    if (
      result.status === "connected" ||
      result.status === "connected-redirect"
    ) {
      await writeTokenRecord(installation.id, result.tokens);
    }

    // Store completion result in Redis for CLI polling (5-min TTL)
    await redis
      .pipeline()
      .hset(oauthResultKey(state), {
        status: "completed",
        provider: providerName,
        ...(reactivated ? { reactivated: "true" } : {}),
      })
      .expire(oauthResultKey(state), 300)
      .exec();

    // Provider-specific redirect (e.g. Vercel "next" URL to complete installation lifecycle)
    if (result.status === "connected-redirect") {
      return c.redirect(result.nextUrl);
    }

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
                <h1 style="margin:0 0 8px">Connected to ${providerName}!</h1>
                <p style="color:#666">You can close this tab and return to your terminal.</p>
              </div>
              ${raw("<script>setTimeout(()=>window.close(),2000)</script>")}
            </body>
          </html>`
      );
    }

    if (redirectTo) {
      // Explicit redirect URL (validated during authorize)
      const redirectUrl = new URL(redirectTo);
      if (reactivated) {
        redirectUrl.searchParams.set("reactivated", "true");
      }
      return c.redirect(redirectUrl.toString());
    }

    // Default: redirect to console (existing behavior, backwards compatible)
    const redirectUrl = new URL(
      `${consoleUrl}/provider/${providerName}/connected`
    );
    if (reactivated) {
      redirectUrl.searchParams.set("reactivated", "true");
    }
    return c.redirect(redirectUrl.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    c.set("logFields", {
      ...c.get("logFields"),
      provider: providerName,
      callbackError: message,
    });
    log.error("[connections] oauth callback failed", {
      provider: providerName,
      error: message,
    });

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
        400
      );
    }

    if (redirectTo) {
      return c.redirect(`${redirectTo}?error=${encodeURIComponent(message)}`);
    }

    return c.redirect(
      `${consoleUrl}/provider/${providerName}/connected?error=${encodeURIComponent(message)}`
    );
  }
});

// ── Lifecycle ──
// INTERNAL-ONLY: These endpoints are called exclusively by trusted backend
// services (backfill orchestrator, entity worker) that hold GATEWAY_API_KEY.
// They are NOT reachable from external clients — the console's Next.js rewrite
// for /services/gateway/* is blocked by both Clerk middleware and the
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

  const installation = await db.query.gatewayInstallations.findFirst({
    where: eq(gatewayInstallations.id, id),
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
      resources: { where: eq(gatewayResources.status, "active") },
    },
  });

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({
    id: installation.id,
    provider: installation.provider,
    externalId: installation.externalId,
    orgId: installation.orgId,
    status: installation.status,
    hasToken:
      !getProvider(installation.provider).auth.usesStoredToken ||
      installation.tokens.length > 0,
    tokenExpiresAt: installation.tokens[0]?.expiresAt ?? null,
    resources: installation.resources.map(
      (r: (typeof installation.resources)[number]) => ({
        id: r.id,
        providerResourceId: r.providerResourceId,
        resourceName: r.resourceName,
      })
    ),
    createdAt: installation.createdAt,
    updatedAt: installation.updatedAt,
  });
});

// ── Token Helpers ──

/**
 * Get the active token for an installation, handling expiry and on-demand refresh.
 * Shared by GET /:id/token and POST /:id/proxy/execute.
 */
async function getActiveTokenForInstallation(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<{ token: string; expiresAt: string | null }> {
  const tokenRows = await db
    .select()
    .from(gatewayTokens)
    .where(eq(gatewayTokens.installationId, installation.id))
    .limit(1);

  const tokenRow = tokenRows[0];

  // Handle refresh if expired
  if (tokenRow?.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
    if (!tokenRow.refreshToken) {
      throw new Error("token_expired:no_refresh_token");
    }
    const decryptedRefresh = await decrypt(
      tokenRow.refreshToken,
      getEncryptionKey()
    );
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the gateway cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    const auth = providerDef.auth;
    if (auth.kind !== "oauth") {
      throw new Error("token_expired:provider_does_not_support_token_refresh");
    }
    const refreshed = await auth.refreshToken(
      config as never,
      decryptedRefresh
    );
    await updateTokenRecord(
      tokenRow.id,
      refreshed,
      tokenRow.refreshToken,
      tokenRow.expiresAt
    );
    return { token: refreshed.accessToken, expiresAt: tokenRow.expiresAt };
  }

  const decryptedAccessToken = tokenRow
    ? await decrypt(tokenRow.accessToken, getEncryptionKey())
    : null;

  // SAFETY: config is providerConfigs[providerName], created by the same provider's
  // createConfig(). Runtime type matches TConfig; the gateway cannot know TConfig
  // statically because it serves all providers from a single Record<string, unknown>.
  const token = await providerDef.auth.getActiveToken(
    config as never,
    installation.externalId,
    decryptedAccessToken
  );

  return { token, expiresAt: tokenRow?.expiresAt ?? null };
}

/**
 * Force-refresh the token — used for 401 retry in POST /:id/proxy/execute.
 * Returns null if all refresh attempts fail.
 */
async function forceRefreshToken(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<string | null> {
  const tokenRows = await db
    .select()
    .from(gatewayTokens)
    .where(eq(gatewayTokens.installationId, installation.id))
    .limit(1);
  const row = tokenRows[0];

  if (row?.refreshToken) {
    try {
      const decryptedRefresh = await decrypt(
        row.refreshToken,
        getEncryptionKey()
      );
      // SAFETY: config is providerConfigs[providerName], created by the same provider's
      // createConfig(). Runtime type matches TConfig; the gateway cannot know TConfig
      // statically because it serves all providers from a single Record<string, unknown>.
      const auth = providerDef.auth;
      if (auth.kind !== "oauth") {
        return null; // API key providers don't refresh tokens
      }
      const refreshed = await auth.refreshToken(
        config as never,
        decryptedRefresh
      );
      await updateTokenRecord(
        row.id,
        refreshed,
        row.refreshToken,
        row.expiresAt
      );
      return refreshed.accessToken;
    } catch {
      // Refresh failed — fall through to getActiveToken
    }
  }

  try {
    // SAFETY: config is providerConfigs[providerName], created by the same provider's
    // createConfig(). Runtime type matches TConfig; the gateway cannot know TConfig
    // statically because it serves all providers from a single Record<string, unknown>.
    return await providerDef.auth.getActiveToken(
      config as never,
      installation.externalId,
      null
    );
  } catch {
    return null;
  }
}

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
    .from(gatewayInstallations)
    .where(eq(gatewayInstallations.id, id))
    .limit(1);

  const installation = installationRows[0];

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    return c.json(
      { error: "installation_not_active", status: installation.status },
      400
    );
  }

  const providerName = installation.provider;
  const config = providerConfigs[providerName];

  try {
    const providerDef = getProvider(providerName);

    // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
    // but the helper takes the base ProviderDefinition. The generic parameters are
    // erased at runtime — the cast is safe because the concrete type is a supertype.
    const { token, expiresAt } = await getActiveTokenForInstallation(
      installation,
      config,
      providerDef as ProviderDefinition
    );

    return c.json({
      accessToken: token,
      provider: providerName,
      expiresIn: expiresAt
        ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
        : 3600, // GitHub installation tokens expire in 1 hour
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "no_token_found") {
      return c.json({ error: "no_token_found" }, 404);
    }
    if (
      message === "token_expired" ||
      message === "token_expired:no_refresh_token"
    ) {
      return c.json({ error: "token_expired", message }, 401);
    }
    return c.json({ error: "token_generation_failed", message }, 502);
  }
});

/**
 * GET /connections/:id/proxy/endpoints
 *
 * Returns the provider's API catalog — available endpoints and their specs.
 * Strips responseSchema (Zod types aren't JSON-serializable). Internal-only, requires X-API-Key.
 */
connections.get("/:id/proxy/endpoints", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installation = await db.query.gatewayInstallations.findFirst({
    where: eq(gatewayInstallations.id, id),
  });

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  const providerDef = getProvider(installation.provider);
  if (!providerDef) {
    return c.json({ error: "unknown_provider" }, 400);
  }

  // Strip responseSchema (Zod types aren't serializable)
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

  return c.json({
    provider: installation.provider,
    baseUrl: providerDef.api.baseUrl,
    endpoints,
  });
});

/**
 * POST /connections/:id/proxy/execute
 *
 * Pure authenticated API proxy. Zero domain knowledge.
 * Gateway handles: endpoint validation, auth injection, 401 retry.
 * Gateway returns: raw { status, data, headers }.
 * Internal-only, requires X-API-Key.
 */
connections.post("/:id/proxy/execute", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  let body: {
    endpointId: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!body.endpointId) {
    return c.json({ error: "missing_endpoint_id" }, 400);
  }

  const installation = await db.query.gatewayInstallations.findFirst({
    where: eq(gatewayInstallations.id, id),
  });

  if (!installation) {
    c.set("logFields", {
      ...c.get("logFields"),
      connectionId: id,
      connectionError: "not_found",
    });
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    c.set("logFields", {
      ...c.get("logFields"),
      connectionId: id,
      connectionStatus: installation.status,
      connectionError: "installation_not_active",
    });
    return c.json(
      { error: "installation_not_active", status: installation.status },
      400
    );
  }

  const providerName = installation.provider;
  const providerDef = getProvider(providerName);
  if (!providerDef) {
    c.set("logFields", {
      ...c.get("logFields"),
      connectionId: id,
      provider: providerName,
      connectionError: "unknown_provider",
    });
    return c.json({ error: "unknown_provider" }, 400);
  }

  const config = providerConfigs[providerName];

  // Validate endpoint exists in catalog
  const endpoint = providerDef.api.endpoints[body.endpointId];
  if (!endpoint) {
    c.set("logFields", {
      ...c.get("logFields"),
      connectionId: id,
      provider: providerName,
      endpointId: body.endpointId,
      connectionError: "unknown_endpoint",
    });
    return c.json(
      {
        error: "unknown_endpoint",
        endpointId: body.endpointId,
        available: Object.keys(providerDef.api.endpoints),
      },
      400
    );
  }

  // Get active token.
  // If the endpoint declares its own buildAuth, use it (e.g. GitHub App JWT for app-level
  // endpoints). Otherwise fall through to the default per-installation token flow.
  let token: string;
  try {
    if (endpoint.buildAuth) {
      token = await endpoint.buildAuth(config);
    } else {
      // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
      // but the helper takes the base ProviderDefinition. The generic parameters are
      // erased at runtime — the cast is safe because the concrete type is a supertype.
      ({ token } = await getActiveTokenForInstallation(
        installation,
        config,
        providerDef as ProviderDefinition
      ));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_error";
    c.set("logFields", {
      ...c.get("logFields"),
      connectionId: id,
      provider: providerName,
      connectionError: "token_error",
    });
    log.error("[connections] proxy token error", {
      provider: providerName,
      connectionId: id,
      error: message,
    });
    return c.json({ error: "token_error", message }, 502);
  }

  // Build URL
  let path = endpoint.path;
  if (body.pathParams) {
    for (const [key, val] of Object.entries(body.pathParams)) {
      path = path.replace(`{${key}}`, encodeURIComponent(val));
    }
  }

  let url = `${providerDef.api.baseUrl}${path}`;
  if (body.queryParams && Object.keys(body.queryParams).length > 0) {
    url += `?${new URLSearchParams(body.queryParams).toString()}`;
  }

  // Build headers
  const authHeader = providerDef.api.buildAuthHeader
    ? providerDef.api.buildAuthHeader(token)
    : `Bearer ${token}`;

  const headers: Record<string, string> = {
    Authorization: authHeader,
    ...(providerDef.api.defaultHeaders ?? {}),
  };

  // Build fetch options
  const fetchOptions: RequestInit = {
    method: endpoint.method,
    headers,
    signal: AbortSignal.timeout(endpoint.timeout ?? 30_000),
  };

  if (body.body) {
    fetchOptions.body = JSON.stringify(body.body);
    headers["Content-Type"] = "application/json";
  }

  // Execute with 401 retry
  let response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    let freshToken: string | null = null;
    if (endpoint.buildAuth) {
      try {
        freshToken = await endpoint.buildAuth(config);
      } catch {
        // ignore — fall through without retry
      }
    } else {
      // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
      // but the helper takes the base ProviderDefinition. The generic parameters are
      // erased at runtime — the cast is safe because the concrete type is a supertype.
      freshToken = await forceRefreshToken(
        installation,
        config,
        providerDef as ProviderDefinition
      );
    }
    if (freshToken && freshToken !== token) {
      headers.Authorization = providerDef.api.buildAuthHeader
        ? providerDef.api.buildAuthHeader(freshToken)
        : `Bearer ${freshToken}`;
      response = await fetch(url, { ...fetchOptions, headers });
    }
  }

  // Return raw response — no parsing, no transformation
  const data = await response.json().catch(() => null);
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  c.set("logFields", {
    ...c.get("logFields"),
    connectionId: id,
    provider: installation.provider,
    endpointId: body.endpointId,
    upstreamStatus: response.status,
  });

  return c.json({
    status: response.status,
    data,
    headers: responseHeaders,
  });
});

/**
 * DELETE /connections/:provider/:id
 *
 * Teardown a connection. Triggers a durable workflow and returns immediately.
 * Internal-only, requires X-API-Key authentication.
 * Callers: console tRPC (org/connections.disconnect)
 */
connections.delete("/:provider/:id", apiKeyAuth, async (c) => {
  const providerName = c.req.param("provider") as SourceType;
  const id = c.req.param("id");

  const installationRows = await db
    .select()
    .from(gatewayInstallations)
    .where(
      and(
        eq(gatewayInstallations.id, id),
        eq(gatewayInstallations.provider, providerName)
      )
    )
    .limit(1);

  const installation = installationRows[0];

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  // Trigger durable teardown workflow
  await workflowClient.trigger({
    url: `${gatewayBaseUrl}/gateway/workflows/connection-teardown`,
    body: JSON.stringify({
      installationId: id,
      provider: providerName,
      orgId: installation.orgId,
    }),
    headers: { "Content-Type": "application/json" },
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
    .from(gatewayInstallations)
    .where(eq(gatewayInstallations.id, id))
    .limit(1);

  const installation = installationRows[0];

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    return c.json(
      { error: "installation_not_active", status: installation.status },
      400
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
    .select({ id: gatewayResources.id })
    .from(gatewayResources)
    .where(
      and(
        eq(gatewayResources.installationId, id),
        eq(gatewayResources.providerResourceId, body.providerResourceId),
        eq(gatewayResources.status, "active")
      )
    )
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    return c.json(
      { error: "resource_already_linked", resourceId: existing.id },
      409
    );
  }

  const resourceRows = await db
    .insert(gatewayResources)
    .values({
      installationId: id,
      providerResourceId: body.providerResourceId,
      resourceName: body.resourceName,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [
        gatewayResources.installationId,
        gatewayResources.providerResourceId,
      ],
      set: {
        status: "active",
        ...(body.resourceName !== undefined
          ? { resourceName: body.resourceName }
          : {}),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning();

  const resource = resourceRows[0];
  if (!resource) {
    return c.json({ error: "insert_failed" }, 500);
  }

  // Populate Redis routing cache
  await redis.hset(
    resourceKey(installation.provider, body.providerResourceId),
    { connectionId: id, orgId: installation.orgId }
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
    .from(gatewayResources)
    .where(
      and(
        eq(gatewayResources.id, resourceId),
        eq(gatewayResources.installationId, id)
      )
    )
    .limit(1);

  const resource = resourceRows[0];

  if (!resource) {
    return c.json({ error: "not_found" }, 404);
  }

  if (resource.status === "removed") {
    return c.json({ error: "already_removed" }, 400);
  }

  await db
    .update(gatewayResources)
    .set({ status: "removed" })
    .where(eq(gatewayResources.id, resourceId));

  const installationRows = await db
    .select({ provider: gatewayInstallations.provider })
    .from(gatewayInstallations)
    .where(eq(gatewayInstallations.id, id))
    .limit(1);

  const installation = installationRows[0];

  if (installation) {
    await redis.del(
      resourceKey(installation.provider, resource.providerResourceId)
    );
  }

  return c.json({ status: "removed", resourceId });
});

// ── Backfill Run Tracking ──
// INTERNAL-ONLY: Called by backfill orchestrator + entity workers

connections.get("/:id/backfill-runs", apiKeyAuth, async (c) => {
  const installationId = c.req.param("id");
  const statusFilter = c.req.query("status");

  const conditions = [eq(gatewayBackfillRuns.installationId, installationId)];
  if (statusFilter) {
    conditions.push(eq(gatewayBackfillRuns.status, statusFilter));
  }

  const runs = await db
    .select({
      entityType: gatewayBackfillRuns.entityType,
      providerResourceId: gatewayBackfillRuns.providerResourceId,
      since: gatewayBackfillRuns.since,
      depth: gatewayBackfillRuns.depth,
      status: gatewayBackfillRuns.status,
      pagesProcessed: gatewayBackfillRuns.pagesProcessed,
      eventsProduced: gatewayBackfillRuns.eventsProduced,
      eventsDispatched: gatewayBackfillRuns.eventsDispatched,
      completedAt: gatewayBackfillRuns.completedAt,
    })
    .from(gatewayBackfillRuns)
    .where(and(...conditions));

  return c.json(runs);
});

connections.post("/:id/backfill-runs", apiKeyAuth, async (c) => {
  const installationId = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = backfillRunRecord.safeParse(body);

  if (!parsed.success) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return c.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date().toISOString();
  const data = parsed.data;
  const isTerminal = (BACKFILL_TERMINAL_STATUSES as readonly string[]).includes(
    data.status
  );

  const sharedFields = {
    since: data.since,
    depth: data.depth,
    status: data.status,
    pagesProcessed: data.pagesProcessed,
    eventsProduced: data.eventsProduced,
    eventsDispatched: data.eventsDispatched,
    error: data.error ?? null,
    completedAt: isTerminal ? now : null,
    updatedAt: now,
  };

  await db
    .insert(gatewayBackfillRuns)
    .values({
      installationId,
      entityType: data.entityType,
      providerResourceId: data.providerResourceId,
      ...sharedFields,
      startedAt: data.status === "running" ? now : null,
    })
    .onConflictDoUpdate({
      target: [
        gatewayBackfillRuns.installationId,
        gatewayBackfillRuns.providerResourceId,
        gatewayBackfillRuns.entityType,
      ],
      set: sharedFields,
    });

  return c.json({ status: "ok" });
});

export { connections };
