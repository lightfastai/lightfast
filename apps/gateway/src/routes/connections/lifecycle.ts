import { and, eq } from "drizzle-orm";
import {
  gwInstallations,
  gwResources,
} from "@db/console/schema";
import { db } from "@db/console/client";
import { Hono } from "hono";
import type { TenantVariables } from "../../middleware/tenant";
import { apiKeyAuth } from "../../middleware/auth";
import { gatewayBaseUrl } from "../../lib/base-url";
import { workflowClient } from "../../lib/workflow-client";
import type { ProviderName } from "../../providers/types";

const lifecycle = new Hono<{ Variables: TenantVariables }>();

/**
 * GET /connections/:id
 *
 * Get connection details. Requires X-API-Key authentication.
 */
lifecycle.get("/:id", apiKeyAuth, async (c) => {
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
lifecycle.get("/:id/token", apiKeyAuth, async (c) => {
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

  const { getStrategy } = await import("../../strategies/registry");
  const strategy = getStrategy(installation.provider as ProviderName);

  try {
    const result = await strategy.resolveToken(installation);
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
lifecycle.delete("/:provider/:id", apiKeyAuth, async (c) => {
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
    url: `${gatewayBaseUrl}/workflows/connection-teardown`,
    body: {
      installationId: id,
      provider: providerName,
      orgId: installation.orgId,
    },
  });

  return c.json({ status: "teardown_initiated", installationId: id });
});

export { lifecycle };
