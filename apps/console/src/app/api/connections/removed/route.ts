import { serve } from "@vendor/upstash-workflow/nextjs";
import { db } from "@db/console/client";
import { eq } from "drizzle-orm";
import { userSources, workspaceIntegrations } from "@db/console/schema";

export const runtime = "nodejs";

interface ConnectionRemovedPayload {
  installationId: string;
  provider: string;
  orgId: string;
}

/**
 * POST /api/connections/removed
 *
 * Called by the Gateway (via QStash) after a connection is torn down.
 * Soft-deletes the corresponding userSources and workspaceIntegrations records.
 *
 * QStash signature verification is handled automatically by serve().
 */
export const { POST } = serve<ConnectionRemovedPayload>(async (context) => {
  const data = context.requestPayload;

  await context.run("deactivate-source", async () => {
    // Find the userSource linked to this gateway installation
    const source = await db.query.userSources.findFirst({
      where: eq(userSources.gatewayInstallationId, data.installationId),
      columns: { id: true },
    });

    if (!source) {
      console.warn(
        `[connections/removed] No userSource found for gateway installation: ${data.installationId}`,
      );
      return;
    }

    // Soft-delete userSource
    await db
      .update(userSources)
      .set({ isActive: false })
      .where(eq(userSources.id, source.id));

    // Soft-delete all workspace integrations linked to this source
    await db
      .update(workspaceIntegrations)
      .set({ isActive: false })
      .where(eq(workspaceIntegrations.userSourceId, source.id));
  });
});
