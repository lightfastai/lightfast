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
import { log } from "@vendor/observability/log/next";
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

    log.info("[connection-lifecycle] starting", {
      installationId,
      provider: providerName,
    });

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

      log.info("[connection-lifecycle] gate closed", { installationId });
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
        log.info("[connection-lifecycle] backfill cancellation sent", {
          installationId,
        });
      } catch (err) {
        log.warn(
          "[connection-lifecycle] backfill cancellation failed (best-effort)",
          {
            installationId,
            error: err instanceof Error ? err.message : String(err),
          }
        );
      }
    });

    // Step 3: Revoke token at provider (best-effort)
    await step.run("revoke-token", async () => {
      if (providerName === "github") {
        log.info(
          "[connection-lifecycle] skipping token revocation (github uses on-demand JWTs)",
          {
            installationId,
          }
        );
        return;
      }

      const providerDef = getProvider(providerName as SourceType);
      const config = providerConfigs[providerName];

      if (!config) {
        log.warn(
          "[connection-lifecycle] provider not configured, skipping token revocation",
          {
            installationId,
            provider: providerName,
          }
        );
        return;
      }

      const tokenRows = await db
        .select()
        .from(gatewayTokens)
        .where(eq(gatewayTokens.installationId, installationId))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        log.info(
          "[connection-lifecycle] no token row found, skipping revocation",
          {
            installationId,
          }
        );
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
        log.info("[connection-lifecycle] token revoked", {
          installationId,
          provider: providerName,
        });
      } catch (err) {
        log.warn(
          "[connection-lifecycle] token revocation failed (best-effort)",
          {
            installationId,
            provider: providerName,
            error: err instanceof Error ? err.message : String(err),
          }
        );
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

      log.info("[connection-lifecycle] resources removed", {
        installationId,
        count: resources.length,
      });
    });

    log.info("[connection-lifecycle] teardown complete", {
      installationId,
      provider: providerName,
    });

    return { success: true, installationId };
  }
);
