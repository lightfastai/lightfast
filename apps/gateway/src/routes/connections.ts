import { and, eq } from "drizzle-orm";
import { installations, resources, tokens } from "@db/gateway/schema";
import { nanoid } from "@repo/lib";
import { Hono } from "hono";
import type { WebhookRegistrant, ProviderName } from "../providers/types";
import { db } from "../lib/db";
import { encrypt, decrypt } from "../lib/crypto";
import { gatewayBaseUrl } from "../lib/base-url";
import { oauthStateKey, resourceKey } from "../lib/keys";
import { qstash } from "../lib/qstash";
import { redis } from "../lib/redis";
import { consoleUrl } from "../lib/related-projects";
import { apiKeyAuth } from "../middleware/auth";
import type { TenantVariables } from "../middleware/tenant";
import { tenantMiddleware } from "../middleware/tenant";
import { getProvider } from "../providers";
import { env } from "../env";

const connections = new Hono<{ Variables: TenantVariables }>();

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

  if (!orgId) {
    return c.json({ error: "missing_org_id" }, 400);
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
 * GET /connections/:provider/callback
 *
 * OAuth callback. Validates state, exchanges code, stores installation + tokens.
 */
connections.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  // --- GitHub App installation flow ---
  if (provider.name === "github") {
    const installationId = c.req.query("installation_id");
    const setupAction = c.req.query("setup_action");
    const githubState = c.req.query("state");

    if (!installationId || !githubState) {
      return c.json(
        { error: "missing_params", required: ["installation_id", "state"] },
        400,
      );
    }

    const stateData = await redis.hgetall<Record<string, string>>(
      oauthStateKey(githubState),
    );
    if (!stateData?.orgId) {
      return c.json({ error: "invalid_or_expired_state" }, 400);
    }
    await redis.del(oauthStateKey(githubState));

    // Upsert installation (idempotent)
    const existing = await db
      .select({ id: installations.id })
      .from(installations)
      .where(
        and(
          eq(installations.provider, "github"),
          eq(installations.externalId, installationId),
        ),
      )
      .get();

    if (existing) {
      await db
        .update(installations)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(installations.id, existing.id));

      await notifyConsoleSync({
        installationId: existing.id,
        provider: "github",
        orgId: stateData.orgId,
        connectedBy: stateData.connectedBy ?? "unknown",
        externalId: installationId,
      });

      return c.json({
        status: "connected",
        installationId: existing.id,
        provider: "github",
        setupAction,
        reactivated: true,
      });
    }

    const rows = await db
      .insert(installations)
      .values({
        provider: "github",
        externalId: installationId,
        connectedBy: stateData.connectedBy ?? "unknown",
        orgId: stateData.orgId,
        status: "active",
      })
      .returning({ id: installations.id });

    const row = rows[0];
    if (!row) return c.json({ error: "insert_failed" }, 500);

    await notifyConsoleSync({
      installationId: row.id,
      provider: "github",
      orgId: stateData.orgId,
      connectedBy: stateData.connectedBy ?? "unknown",
      externalId: installationId,
    });

    return c.json({
      status: "connected",
      installationId: row.id,
      provider: "github",
      setupAction,
    });
  }

  // --- Standard OAuth flow (Vercel, Linear, Sentry) ---
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ error: "missing_params", required: ["code", "state"] }, 400);
  }

  const stateData = await redis.hgetall<Record<string, string>>(
    oauthStateKey(state),
  );
  if (!stateData?.orgId || stateData.provider !== provider.name) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }
  await redis.del(oauthStateKey(state));

  const redirectUri = `${gatewayBaseUrl}/connections/${provider.name}/callback`;
  let oauthTokens;
  try {
    oauthTokens = await provider.exchangeCode(code, redirectUri);
  } catch (err) {
    return c.json(
      {
        error: "token_exchange_failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      502,
    );
  }

  const installationRows = await db
    .insert(installations)
    .values({
      provider: provider.name,
      externalId:
        (oauthTokens.raw.team_id as string | undefined)?.toString() ??
        (oauthTokens.raw.organization_id as string | undefined)?.toString() ??
        (oauthTokens.raw.installation as string | undefined)?.toString() ??
        nanoid(),
      connectedBy: stateData.connectedBy ?? "unknown",
      orgId: stateData.orgId,
      status: "active",
    })
    .returning({ id: installations.id });

  const installation = installationRows[0];
  if (!installation) return c.json({ error: "insert_failed" }, 500);

  const encryptedAccess = await encrypt(
    oauthTokens.accessToken,
    env.ENCRYPTION_KEY,
  );
  const encryptedRefresh = oauthTokens.refreshToken
    ? await encrypt(oauthTokens.refreshToken, env.ENCRYPTION_KEY)
    : null;

  await db.insert(tokens).values({
    installationId: installation.id,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt: oauthTokens.expiresIn
      ? new Date(Date.now() + oauthTokens.expiresIn * 1000)
      : null,
    tokenType: oauthTokens.tokenType,
    scope: oauthTokens.scope,
  });

  // Register webhook if provider requires it (Linear, Sentry)
  if (provider.requiresWebhookRegistration) {
    const registrant = provider as WebhookRegistrant;
    const webhookSecret = nanoid(32);
    const callbackUrl = `${gatewayBaseUrl}/webhooks/${provider.name}`;

    try {
      const webhookId = await registrant.registerWebhook(
        installation.id,
        callbackUrl,
        webhookSecret,
      );

      await db
        .update(installations)
        .set({
          webhookSecret,
          metadata: { webhookId } as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(installations.id, installation.id));
    } catch (err) {
      await db
        .update(installations)
        .set({
          metadata: {
            webhookRegistrationError:
              err instanceof Error ? err.message : "unknown",
          } as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(installations.id, installation.id));
    }
  }

  const externalId =
    (oauthTokens.raw.team_id as string | undefined)?.toString() ??
    (oauthTokens.raw.organization_id as string | undefined)?.toString() ??
    (oauthTokens.raw.installation as string | undefined)?.toString() ??
    "";

  await notifyConsoleSync({
    installationId: installation.id,
    provider: provider.name,
    orgId: stateData.orgId,
    connectedBy: stateData.connectedBy ?? "unknown",
    externalId,
  });

  return c.json({
    status: "connected",
    installationId: installation.id,
    provider: provider.name,
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

  const installation = await db
    .select()
    .from(installations)
    .where(eq(installations.id, id))
    .get();

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  if (installation.status !== "active") {
    return c.json(
      { error: "installation_not_active", status: installation.status },
      400,
    );
  }

  // GitHub: generate token on-demand (no stored token)
  if (installation.provider === "github") {
    const { getInstallationToken } = await import("../lib/github-jwt");
    try {
      const token = await getInstallationToken(installation.externalId);
      return c.json({
        accessToken: token,
        provider: "github",
        expiresIn: 3600, // GitHub installation tokens expire in 1 hour
      });
    } catch (err) {
      return c.json(
        {
          error: "token_generation_failed",
          message: err instanceof Error ? err.message : "unknown",
        },
        502,
      );
    }
  }

  // OAuth providers: decrypt stored token
  const tokenRow = await db
    .select()
    .from(tokens)
    .where(eq(tokens.installationId, id))
    .get();

  if (!tokenRow) {
    return c.json({ error: "no_token_found" }, 404);
  }

  // Check expiry and refresh if needed
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
    if (!tokenRow.refreshToken) {
      return c.json(
        { error: "token_expired", message: "no refresh token available" },
        401,
      );
    }

    const provider = getProvider(installation.provider);
    const decryptedRefresh = await decrypt(
      tokenRow.refreshToken,
      env.ENCRYPTION_KEY,
    );
    try {
      const refreshed = await provider.refreshToken(decryptedRefresh);
      const encryptedAccess = await encrypt(
        refreshed.accessToken,
        env.ENCRYPTION_KEY,
      );
      const newEncryptedRefresh = refreshed.refreshToken
        ? await encrypt(refreshed.refreshToken, env.ENCRYPTION_KEY)
        : tokenRow.refreshToken;

      await db
        .update(tokens)
        .set({
          accessToken: encryptedAccess,
          refreshToken: newEncryptedRefresh,
          expiresAt: refreshed.expiresIn
            ? new Date(Date.now() + refreshed.expiresIn * 1000)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(tokens.id, tokenRow.id));

      return c.json({
        accessToken: refreshed.accessToken,
        provider: installation.provider,
        expiresIn: refreshed.expiresIn,
      });
    } catch (err) {
      return c.json(
        {
          error: "token_refresh_failed",
          message: err instanceof Error ? err.message : "unknown",
        },
        502,
      );
    }
  }

  const decryptedToken = await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
  return c.json({
    accessToken: decryptedToken,
    provider: installation.provider,
    expiresIn: tokenRow.expiresAt
      ? Math.floor((tokenRow.expiresAt.getTime() - Date.now()) / 1000)
      : null,
  });
});

/**
 * GET /connections/:id
 *
 * Get connection details. Requires X-API-Key authentication.
 */
connections.get("/:id", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installation = await db.query.installations.findFirst({
    where: eq(installations.id, id),
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
      resources: { where: eq(resources.status, "active") },
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
 * DELETE /connections/:provider/:id
 *
 * Teardown a connection. Requires X-API-Key authentication.
 */
connections.delete("/:provider/:id", apiKeyAuth, async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const id = c.req.param("id");

  const installation = await db
    .select()
    .from(installations)
    .where(and(eq(installations.id, id), eq(installations.provider, providerName)))
    .get();

  if (!installation) {
    return c.json({ error: "not_found" }, 404);
  }

  const provider = getProvider(providerName);

  // Revoke token at provider (best-effort)
  if (installation.provider !== "github") {
    const tokenRow = await db
      .select()
      .from(tokens)
      .where(eq(tokens.installationId, id))
      .get();

    if (tokenRow) {
      try {
        const decryptedToken = await decrypt(
          tokenRow.accessToken,
          env.ENCRYPTION_KEY,
        );
        await provider.revokeToken(decryptedToken);
      } catch {
        // Best-effort — continue with teardown even if revocation fails
      }
    }
  }

  // Deregister webhook if applicable
  if (provider.requiresWebhookRegistration) {
    const registrant = provider as WebhookRegistrant;
    const meta = installation.metadata as Record<string, unknown> | null;
    const webhookId = meta?.webhookId as string | undefined;
    if (webhookId) {
      try {
        await registrant.deregisterWebhook(id, webhookId);
      } catch {
        // Best-effort
      }
    }
  }

  // Clean up Redis cache for linked resources
  const linkedResources = await db
    .select({ providerResourceId: resources.providerResourceId })
    .from(resources)
    .where(and(eq(resources.installationId, id), eq(resources.status, "active")));

  for (const r of linkedResources) {
    await redis.del(resourceKey(installation.provider, r.providerResourceId));
  }

  // Mark installation as revoked (soft delete — preserves audit trail)
  await db
    .update(installations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(installations.id, id));

  // Mark resources as removed
  await db
    .update(resources)
    .set({ status: "removed" })
    .where(eq(resources.installationId, id));

  await notifyConsoleRemoved({
    installationId: id,
    provider: providerName,
    orgId: installation.orgId,
  });

  return c.json({ status: "revoked", installationId: id });
});

/**
 * POST /connections/:id/resources
 *
 * Link a resource to a connection. Requires X-API-Key authentication.
 */
connections.post("/:id/resources", apiKeyAuth, async (c) => {
  const id = c.req.param("id");

  const installation = await db
    .select()
    .from(installations)
    .where(eq(installations.id, id))
    .get();

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

  const existing = await db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.installationId, id),
        eq(resources.providerResourceId, body.providerResourceId),
        eq(resources.status, "active"),
      ),
    )
    .get();

  if (existing) {
    return c.json(
      { error: "resource_already_linked", resourceId: existing.id },
      409,
    );
  }

  const resourceRows = await db
    .insert(resources)
    .values({
      installationId: id,
      providerResourceId: body.providerResourceId,
      resourceName: body.resourceName,
      status: "active",
    })
    .returning();

  const resource = resourceRows[0];
  if (!resource) return c.json({ error: "insert_failed" }, 500);

  // Populate Redis routing cache
  await redis.hset(resourceKey(installation.provider, body.providerResourceId), {
    connectionId: id,
    orgId: installation.orgId,
  });

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

  const resource = await db
    .select()
    .from(resources)
    .where(and(eq(resources.id, resourceId), eq(resources.installationId, id)))
    .get();

  if (!resource) {
    return c.json({ error: "not_found" }, 404);
  }

  if (resource.status === "removed") {
    return c.json({ error: "already_removed" }, 400);
  }

  await db
    .update(resources)
    .set({ status: "removed" })
    .where(eq(resources.id, resourceId));

  const installation = await db
    .select({ provider: installations.provider })
    .from(installations)
    .where(eq(installations.id, id))
    .get();

  if (installation) {
    await redis.del(
      resourceKey(installation.provider, resource.providerResourceId),
    );
  }

  return c.json({ status: "removed", resourceId });
});

/**
 * Notify Console about a new or reactivated connection via QStash.
 * Best-effort — failure here should not block the OAuth response.
 */
async function notifyConsoleSync(params: {
  installationId: string;
  provider: string;
  orgId: string;
  connectedBy: string;
  externalId: string;
  accountLogin?: string;
}) {
  try {
    await qstash.publishJSON({
      url: `${consoleUrl}/api/connections/sync`,
      body: params,
      retries: 3,
    });
  } catch (err) {
    console.error("[connections] Failed to notify Console of sync:", err);
  }
}

/**
 * Notify Console about a removed connection via QStash.
 * Best-effort — failure here should not block the teardown response.
 */
async function notifyConsoleRemoved(params: {
  installationId: string;
  provider: string;
  orgId: string;
}) {
  try {
    await qstash.publishJSON({
      url: `${consoleUrl}/api/connections/removed`,
      body: params,
      retries: 3,
    });
  } catch (err) {
    console.error("[connections] Failed to notify Console of removal:", err);
  }
}

export { connections };
