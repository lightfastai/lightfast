import { db } from "@db/console/client";
import {
  gatewayInstallations,
  gatewayResources,
  gatewayTokens,
} from "@db/console/schema";
import type { RuntimeConfig, SourceType } from "@repo/console-providers";
import { getProvider } from "@repo/console-providers";
import { backfillUrl } from "@repo/gateway-service-clients";
import { decrypt } from "@repo/lib";
import { and, eq } from "@vendor/db";
import { getQStashClient } from "@vendor/qstash";
import { redis } from "@vendor/upstash";
import type { WorkflowContext } from "@vendor/upstash-workflow";
import { serve } from "@vendor/upstash-workflow/hono";
import { env } from "../env.js";
import { resourceKey } from "../lib/cache.js";
import { getEncryptionKey } from "../lib/encryption.js";
import { gatewayBaseUrl } from "../lib/urls.js";

interface TeardownPayload {
  installationId: string;
  orgId: string;
  provider: SourceType;
}

/**
 * Durable connection teardown workflow.
 *
 * Durable connection teardown with step-level retries:
 * - Step 1: Cancel any running backfill (best-effort)
 * - Step 2: Revoke token at provider (best-effort)
 * - Step 3: Clean up Redis cache for linked resources
 * - Step 4: Soft-delete installation and resources in DB
 *
 * Each step runs independently with automatic retries.
 */
export const connectionTeardownWorkflow = serve<TeardownPayload>(
  async (context: WorkflowContext<TeardownPayload>) => {
    const { installationId, provider: providerName } = context.requestPayload;

    // Step 1: Cancel any running backfill (best-effort, before revoking token)
    await context.run("cancel-backfill", async () => {
      try {
        const qstash = getQStashClient();
        await qstash.publishJSON({
          url: `${backfillUrl}/trigger/cancel`,
          headers: {
            "X-API-Key": env.GATEWAY_API_KEY!,
          },
          body: { installationId },
          retries: 3,
          deduplicationId: `backfill-cancel:${installationId}`,
        });
      } catch {
        // Best-effort — swallow errors so teardown proceeds
      }
    });

    // Step 2: Revoke token at provider (best-effort)
    await context.run("revoke-token", async () => {
      if (providerName === "github") {
        return;
      } // GitHub uses on-demand JWTs, no stored token

      const providerDef = getProvider(providerName);

      const teardownRuntime: RuntimeConfig = {
        callbackBaseUrl: gatewayBaseUrl,
      };
      const config = providerDef.createConfig(
        env as unknown as Record<string, string>,
        teardownRuntime
      );

      if (!config) {
        return; // optional provider not configured — no token to revoke
      }

      const tokenRows = await db
        .select()
        .from(gatewayTokens)
        .where(eq(gatewayTokens.installationId, installationId))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        return;
      }

      try {
        const decryptedToken = await decrypt(
          tokenRow.accessToken,
          getEncryptionKey()
        );
        await providerDef.oauth.revokeToken(config as never, decryptedToken);
      } catch {
        // Best-effort — swallow errors
      }
    });

    // Step 3: Clean up Redis cache for linked resources
    await context.run("cleanup-cache", async () => {
      const linkedResources = await db
        .select({ providerResourceId: gatewayResources.providerResourceId })
        .from(gatewayResources)
        .where(
          and(
            eq(gatewayResources.installationId, installationId),
            eq(gatewayResources.status, "active")
          )
        );

      const keys = linkedResources.map((r) =>
        resourceKey(providerName, r.providerResourceId)
      );
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    });

    // Step 4: Soft-delete installation and resources in DB
    await context.run("soft-delete", async () => {
      // Batch: atomic soft-delete (neon-http doesn't support transactions)
      await db.batch([
        db
          .update(gatewayInstallations)
          .set({ status: "revoked", updatedAt: new Date().toISOString() })
          .where(eq(gatewayInstallations.id, installationId)),
        db
          .update(gatewayResources)
          .set({ status: "removed", updatedAt: new Date().toISOString() })
          .where(eq(gatewayResources.installationId, installationId)),
      ] as const);
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
  }
);
