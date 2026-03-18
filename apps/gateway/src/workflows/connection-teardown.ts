import { db } from "@db/console/client";
import {
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayResources,
  gatewayTokens,
} from "@db/console/schema";
import type { RuntimeConfig, SourceType } from "@repo/console-providers";
import { getProvider } from "@repo/console-providers";
import { backfillUrl } from "@repo/gateway-service-clients";
import { decrypt } from "@repo/lib";
import { and, eq } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
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
 * Gate-first teardown with step-level retries:
 * - Step 1: Close the ingress gate (set installation status to 'revoked')
 * - Step 2: Cancel any running backfill (best-effort)
 * - Step 3: Revoke token at provider (best-effort)
 * - Step 4: Clean up Redis cache for linked resources
 * - Step 5: Remove linked resources in DB
 *
 * The gate is closed in step 1 so all downstream guards reject in-flight
 * requests immediately. Each subsequent step runs independently with
 * automatic retries.
 */
export const connectionTeardownWorkflow = serve<TeardownPayload>(
  async (context: WorkflowContext<TeardownPayload>) => {
    const { installationId, provider: providerName } = context.requestPayload;

    // Step 1: Close the ingress gate — all guards check status === 'active',
    // so setting 'revoked' immediately blocks new requests.
    // Idempotent: re-executing on an already-revoked installation is a no-op.
    await context.run("close-gate", async () => {
      await db
        .update(gatewayInstallations)
        .set({ status: "revoked", updatedAt: new Date().toISOString() })
        .where(eq(gatewayInstallations.id, installationId));

      await db.insert(gatewayLifecycleLogs).values({
        installationId,
        event: "gate_closed",
        fromStatus: "active",
        toStatus: "revoked",
        reason: "Ingress gate closed by teardown workflow",
        metadata: {
          step: "close-gate",
          workflowContext: "connection-teardown",
          triggeredBy: "system",
        },
      });
    });

    // Step 2: Cancel any running backfill (best-effort, before revoking token)
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

    // Step 3: Revoke token at provider (best-effort)
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
        const auth = providerDef.auth;
        if (auth.kind === "oauth" && auth.revokeToken) {
          const decryptedToken = await decrypt(
            tokenRow.accessToken,
            getEncryptionKey()
          );
          await auth.revokeToken(config as never, decryptedToken);
        }
      } catch {
        // Best-effort — swallow errors
      }
    });

    // Step 4: Clean up Redis cache for linked resources
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

    // Step 5: Remove linked resources in DB
    // (installation status was already set to 'revoked' in step 1)
    await context.run("remove-resources", async () => {
      // Query resource IDs before updating for the audit log
      const resources = await db
        .select({ providerResourceId: gatewayResources.providerResourceId })
        .from(gatewayResources)
        .where(
          and(
            eq(gatewayResources.installationId, installationId),
            eq(gatewayResources.status, "active")
          )
        );

      await db
        .update(gatewayResources)
        .set({ status: "removed", updatedAt: new Date().toISOString() })
        .where(eq(gatewayResources.installationId, installationId));

      const resourceIdMap: Record<string, string> = {};
      for (const r of resources) {
        resourceIdMap[r.providerResourceId] = "removed";
      }

      await db.insert(gatewayLifecycleLogs).values({
        installationId,
        event: "resources_removed",
        fromStatus: "revoked",
        toStatus: "revoked",
        reason: `Removed ${resources.length} linked resource(s) during teardown`,
        resourceIds: resourceIdMap,
        metadata: {
          step: "remove-resources",
          triggeredBy: "system",
        },
      });
    });
  },
  {
    failureFunction: ({ context: _context, failStatus, failResponse }) => {
      log.error("[connection-teardown] workflow failed", {
        failStatus,
        failResponse: String(failResponse),
      });
      return Promise.resolve();
    },
  }
);
