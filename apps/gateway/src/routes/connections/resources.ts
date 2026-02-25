import { and, eq } from "drizzle-orm";
import { gwInstallations, gwResources } from "@db/console/schema";
import { db } from "@db/console/client";
import { Hono } from "hono";
import type { TenantVariables } from "../../middleware/tenant";
import { apiKeyAuth } from "../../middleware/auth";
import { setResourceCache, deleteResourceCache } from "../../lib/resource-cache";
import type { ProviderName } from "../../providers/types";

const resources = new Hono<{ Variables: TenantVariables }>();

/**
 * POST /connections/:id/resources
 *
 * Link a resource to a connection. Requires X-API-Key authentication.
 */
resources.post("/:id/resources", apiKeyAuth, async (c) => {
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
    .returning();

  const resource = resourceRows[0];
  if (!resource) return c.json({ error: "insert_failed" }, 500);

  // Populate Redis routing cache
  await setResourceCache(
    installation.provider as ProviderName,
    body.providerResourceId,
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
resources.delete("/:id/resources/:resourceId", apiKeyAuth, async (c) => {
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
    await deleteResourceCache(
      installation.provider as ProviderName,
      resource.providerResourceId,
    );
  }

  return c.json({ status: "removed", resourceId });
});

export { resources };
