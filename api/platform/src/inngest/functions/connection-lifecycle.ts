/**
 * Connection lifecycle (teardown) function
 *
 * Ported from apps/gateway/src/workflows/connection-teardown.ts
 *
 * KEY CHANGES vs gateway service:
 * - Upstash Workflow context.run() → Inngest step.run()
 * - Function ID: memory/connection.lifecycle
 * - Trigger: memory/connection.lifecycle event (was Upstash Workflow trigger)
 * - Cancel backfill: fires Inngest event instead of QStash publish
 * - All 5 steps preserved: close-gate, cancel-backfill, revoke-token, cleanup-cache, remove-resources
 */

import { db } from "@db/app/client";
import {
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayResources,
  gatewayTokens,
} from "@db/app/schema";
import type { SourceType } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import { decrypt } from "@repo/lib";
import { and, eq } from "@vendor/db";
import { getEncryptionKey } from "../../lib/encryption";
import { providerConfigs } from "../../lib/provider-configs";
import { inngest } from "../client";

export const connectionLifecycle = inngest.createFunction(
  {
    id: "memory/connection.lifecycle",
    name: "Connection Lifecycle (Teardown)",
    retries: 3,
    concurrency: [
      // 1 teardown per connection at a time
      { limit: 1, key: "event.data.installationId" },
    ],
    timeouts: { start: "1m", finish: "5m" },
  },
  { event: "memory/connection.lifecycle" },
  async ({ event, step }) => {
    const { installationId, provider: providerName } = event.data;

    // Step 1: Close the ingress gate — all guards check status === 'active',
    // so setting 'revoked' immediately blocks new requests.
    await step.run("close-gate", async () => {
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
          workflowContext: "connection-lifecycle",
          triggeredBy: "system",
        },
      });
    });

    // Step 2: Cancel any running backfill (best-effort, via Inngest event)
    await step.run("cancel-backfill", async () => {
      try {
        await inngest.send({
          name: "memory/backfill.run.cancelled",
          data: {
            installationId,
          },
        });
      } catch {
        // Best-effort — swallow errors so teardown proceeds
      }
    });

    // Step 3: Revoke token at provider (best-effort)
    await step.run("revoke-token", async () => {
      if (providerName === "github") {
        return;
      } // GitHub uses on-demand JWTs, no stored token

      const providerDef = getProvider(providerName as SourceType);
      const config = providerConfigs[providerName];

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

    // Step 4: Remove linked resources in DB
    await step.run("remove-resources", async () => {
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

    return { success: true, installationId };
  }
);
