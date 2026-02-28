import { db } from "@db/console/client";
import { gwInstallations, gwResources, gwTokens } from "@db/console/schema";
import { redis } from "@vendor/upstash";
import { serve } from "@vendor/upstash-workflow/hono";
import type { WorkflowContext } from "@vendor/upstash-workflow/types";
import { and, eq } from "drizzle-orm";
import { env } from "../env.js";
import { resourceKey } from "../lib/cache.js";
import { decrypt } from "../lib/crypto.js";
import { cancelBackfillService } from "../lib/urls.js";
import { getProvider } from "../providers/index.js";
import type { ProviderName } from "../providers/types.js";

interface TeardownPayload {
  installationId: string;
  provider: ProviderName;
  orgId: string;
}

/**
 * Durable connection teardown workflow.
 *
 * Durable connection teardown with step-level retries:
 * - Step 1: Cancel any running backfill (best-effort)
 * - Step 2: Revoke token at provider (best-effort)
 * - Step 3: Deregister webhook if applicable (best-effort)
 * - Step 4: Clean up Redis cache for linked resources
 * - Step 5: Soft-delete installation and resources in DB
 *
 * Each step runs independently with automatic retries.
 */
export const connectionTeardownWorkflow = serve<TeardownPayload>(
  async (context: WorkflowContext<TeardownPayload>) => {
    const { installationId, provider: providerName } = context.requestPayload;

    // Step 1: Cancel any running backfill (best-effort, before revoking token)
    await context.run("cancel-backfill", async () => {
      try {
        await cancelBackfillService({ installationId });
      } catch {
        // Best-effort — swallow errors so teardown proceeds
      }
    });

    // Step 2: Revoke token at provider (best-effort)
    await context.run("revoke-token", async () => {
      if (providerName === "github") {return;} // GitHub uses on-demand JWTs, no stored token

      const provider = getProvider(providerName);
      const tokenRows = await db
        .select()
        .from(gwTokens)
        .where(eq(gwTokens.installationId, installationId))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) {return;}

      try {
        const decryptedToken = await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
        await provider.revokeToken(decryptedToken);
      } catch {
        // Best-effort — swallow errors
      }
    });

    // Step 3: Deregister webhook if applicable (best-effort)
    await context.run("deregister-webhook", async () => {
      const provider = getProvider(providerName);
      if (!provider.requiresWebhookRegistration) {return;}

      const installationRows = await db
        .select()
        .from(gwInstallations)
        .where(eq(gwInstallations.id, installationId))
        .limit(1);

      const installation = installationRows[0];
      if (!installation) {return;}

      const meta = installation.metadata as Record<string, unknown> | null;
      const webhookId = meta?.webhookId as string | undefined;

      if (webhookId) {
        try {
          await provider.deregisterWebhook(installationId, webhookId);
        } catch {
          // Best-effort — swallow errors
        }
      }
    });

    // Step 4: Clean up Redis cache for linked resources
    await context.run("cleanup-cache", async () => {
      const linkedResources = await db
        .select({ providerResourceId: gwResources.providerResourceId })
        .from(gwResources)
        .where(
          and(
            eq(gwResources.installationId, installationId),
            eq(gwResources.status, "active"),
          ),
        );

      const keys = linkedResources.map((r) =>
        resourceKey(providerName, r.providerResourceId),
      );
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    });

    // Step 5: Soft-delete installation and resources in DB
    await context.run("soft-delete", async () => {
      await db.transaction(async (tx) => {
        await tx
          .update(gwInstallations)
          .set({ status: "revoked", updatedAt: new Date().toISOString() })
          .where(eq(gwInstallations.id, installationId));

        await tx
          .update(gwResources)
          .set({ status: "removed", updatedAt: new Date().toISOString() })
          .where(eq(gwResources.installationId, installationId));
      });
    });
  },
  {
    failureFunction: ({ context, failStatus, failResponse }) => {
      console.error("[connection-teardown] workflow failed", {
        failStatus,
        failResponse,
        context,
      });
      return Promise.resolve();
    },
  },
);
