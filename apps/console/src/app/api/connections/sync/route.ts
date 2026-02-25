import { serve } from "@vendor/upstash-workflow/nextjs";
import { db } from "@db/console/client";
import { eq, and } from "drizzle-orm";
import { userSources } from "@db/console/schema";
import type { ProviderName } from "@repo/gateway-types";

export const runtime = "nodejs";

interface ConnectionSyncPayload {
  installationId: string;
  provider: ProviderName;
  orgId: string;
  connectedBy: string;
  externalId: string;
  accountLogin?: string;
}

/**
 * POST /api/connections/sync
 *
 * Called by the Gateway (via QStash) after a successful OAuth callback.
 * Creates or updates a userSources record with the Gateway installation ID.
 *
 * QStash signature verification is handled automatically by serve().
 */
export const { POST } = serve<ConnectionSyncPayload>(async (context) => {
  const data = context.requestPayload;

  await context.run("sync-user-source", async () => {
    // Check for existing user source for this user + provider
    const existing = await db
      .select({ id: userSources.id })
      .from(userSources)
      .where(
        and(
          eq(userSources.userId, data.connectedBy),
          eq(userSources.sourceType, data.provider),
        ),
      )
      .limit(1);

    const now = new Date().toISOString();

    if (existing[0]) {
      // Update existing source with gateway installation ID
      await db
        .update(userSources)
        .set({
          gatewayInstallationId: data.installationId,
          isActive: true,
          lastSyncAt: now,
        })
        .where(eq(userSources.id, existing[0].id));
    } else {
      // Create new source — token is managed by Gateway, so use sentinel
      await db.insert(userSources).values({
        userId: data.connectedBy,
        sourceType: data.provider,
        accessToken: `gw:${data.installationId}`,
        gatewayInstallationId: data.installationId,
        providerMetadata: buildProviderMetadata(data),
        isActive: true,
        connectedAt: now,
      });
    }
  });
});

function buildProviderMetadata(data: ConnectionSyncPayload) {
  switch (data.provider) {
    case "github":
      return {
        version: 1 as const,
        sourceType: "github" as const,
        installations: [
          {
            id: data.externalId,
            accountId: data.externalId,
            accountLogin: data.accountLogin ?? "unknown",
            accountType: "Organization" as const,
            avatarUrl: "",
            permissions: {},
            installedAt: new Date().toISOString(),
            lastValidatedAt: new Date().toISOString(),
          },
        ],
      };
    case "vercel":
      return {
        version: 1 as const,
        sourceType: "vercel" as const,
        userId: data.connectedBy,
        configurationId: data.externalId,
      };
    default:
      // Linear and Sentry don't have existing providerMetadata schemas yet.
      // Store minimal info as a github-shaped record for now.
      // TODO: Extend providerMetadata union for linear/sentry in a future phase.
      return {
        version: 1 as const,
        sourceType: "github" as const,
        installations: [],
      };
  }
}
