/**
 * Connection lifecycle (teardown) function
 *
 * Ported from apps/gateway/src/workflows/connection-teardown.ts
 *
 * KEY CHANGES vs gateway service:
 * - Upstash Workflow context.run() → Inngest step.run()
 * - Function ID: platform/connection.lifecycle
 * - Trigger: platform/connection.lifecycle event (was Upstash Workflow trigger)
 * - Cancel backfill: fires Inngest event instead of QStash publish
 * - All 5 steps preserved: close-gate, cancel-backfill, revoke-token, cleanup-cache, remove-resources
 */

import { db } from "@db/app/client";
import {
  gatewayInstallations,
  gatewayLifecycleLogs,
  gatewayTokens,
  orgIntegrations,
} from "@db/app/schema";
import type { SourceType } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import { decrypt } from "@repo/lib";
import { eq } from "@vendor/db";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { getEncryptionKey } from "../../lib/encryption";
import { providerConfigs } from "../../lib/provider-configs";
import { inngest } from "../client";

export const connectionLifecycle = inngest.createFunction(
  {
    id: "platform/connection.lifecycle",
    name: "Connection Lifecycle (Teardown)",
    retries: 3,
    concurrency: [
      // 1 teardown per connection at a time
      { limit: 1, key: "event.data.installationId" },
    ],
    timeouts: { start: "1m", finish: "5m" },
  },
  { event: "platform/connection.lifecycle" },
  async ({ event, step }) => {
    const {
      installationId,
      provider: providerName,
      correlationId,
    } = event.data;

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

      log.info("gate closed");
    });

    // Step 2: Cancel any running backfill (best-effort, via Inngest event)
    await step.run("cancel-backfill", async () => {
      try {
        await inngest.send({
          name: "platform/backfill.run.cancelled",
          data: {
            installationId,
            correlationId,
          },
        });
        log.info("backfill cancellation sent");
      } catch (err) {
        log.warn("backfill cancellation failed (best-effort)", {
          error: parseError(err),
        });
      }
    });

    // Step 3: Revoke token at provider (best-effort)
    await step.run("revoke-token", async () => {
      if (providerName === "github") {
        log.info("skipping token revocation (github uses on-demand JWTs)");
        return;
      }

      const providerDef = getProvider(providerName as SourceType);
      const config = providerConfigs[providerName];

      if (!config) {
        log.warn("provider not configured, skipping token revocation");
        return;
      }

      const tokenRows = await db
        .select()
        .from(gatewayTokens)
        .where(eq(gatewayTokens.installationId, installationId))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        log.info("no token row found, skipping revocation");
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
        log.info("token revoked");
      } catch (err) {
        log.warn("token revocation failed (best-effort)", {
          error: parseError(err),
        });
      }
    });

    // Step 4: Disconnect org integrations and log resource disconnection.
    // For user-initiated disconnects the app-layer cascade may have already
    // set orgIntegrations.status → 'disconnected', but for health-check
    // triggers no cascade runs. We update unconditionally (idempotent).
    await step.run("disconnect-resources", async () => {
      const allResources = await db
        .select({ providerResourceId: orgIntegrations.providerResourceId })
        .from(orgIntegrations)
        .where(eq(orgIntegrations.installationId, installationId));

      if (allResources.length > 0) {
        const now = new Date().toISOString();
        await db
          .update(orgIntegrations)
          .set({
            status: "disconnected",
            statusReason: "installation_revoked",
            updatedAt: now,
          })
          .where(eq(orgIntegrations.installationId, installationId));
      }

      const resourceIdMap: Record<string, string> = {};
      for (const r of allResources) {
        resourceIdMap[r.providerResourceId] = "disconnected";
      }

      await db.insert(gatewayLifecycleLogs).values({
        installationId,
        event: "resources_removed",
        fromStatus: "revoked",
        toStatus: "revoked",
        reason: `Disconnected ${allResources.length} linked resource(s) during teardown`,
        resourceIds: resourceIdMap,
        metadata: { step: "disconnect-resources", triggeredBy: "system" },
      });

      log.info("resources disconnected", {
        count: allResources.length,
      });
    });

    return { success: true, installationId };
  }
);
