import { db } from "@db/console/client";
import {
  gatewayInstallations,
  gatewayLifecycleLogs,
} from "@db/console/schema";
import type {
  ProviderDefinition,
  RuntimeConfig,
  SourceType,
} from "@repo/console-providers";
import { getProvider, PROVIDERS } from "@repo/console-providers";
import { nanoid } from "@repo/lib";
import { eq, sql } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { env } from "../env.js";
import { inngest } from "../inngest/client.js";
import { getActiveTokenForInstallation } from "../lib/token-helpers.js";
import { gatewayBaseUrl } from "../lib/urls.js";

const runtime: RuntimeConfig = { callbackBaseUrl: gatewayBaseUrl };

const FAILURE_THRESHOLD_DEGRADED = 3; // mark healthStatus='degraded'
const FAILURE_THRESHOLD_LIFECYCLE = 6; // fire lifecycle event (~30 min)

export const healthCheck = inngest.createFunction(
  {
    id: "apps-gateway/health.check",
    name: "Health Check (5m cron)",
    retries: 1,
    /**
     * Global concurrency: 1 — prevents overlapping cron runs.
     * If the previous run is still executing when the next cron fires,
     * Inngest queues the new run; it does not drop it.
     */
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // -- Step 1: Fetch all active installations ----------------------------
    const installations = await step.run(
      "list-active-installations",
      async () => {
        return db
          .select({
            id: gatewayInstallations.id,
            provider: gatewayInstallations.provider,
            externalId: gatewayInstallations.externalId,
            orgId: gatewayInstallations.orgId,
            healthCheckFailures: gatewayInstallations.healthCheckFailures,
          })
          .from(gatewayInstallations)
          .where(eq(gatewayInstallations.status, "active"));
      }
    );

    log.info("[health-check] probing installations", {
      count: installations.length,
    });

    // -- Step 2: Probe each installation -----------------------------------
    for (const installation of installations) {
      const providerName = installation.provider as SourceType;
      const providerDef = getProvider(providerName);

      // Skip providers without a health check definition
      if (!providerDef?.healthCheck) {
        continue;
      }

      await step.run(`probe-${installation.id}`, async () => {
        const config = PROVIDERS[providerName]?.createConfig(
          env as unknown as Record<string, string>,
          runtime
        );

        if (!config) {
          log.warn("[health-check] provider not configured — skipping", {
            provider: providerName,
            installationId: installation.id,
          });
          return;
        }

        // Get the decrypted access token (handles on-demand refresh)
        let accessToken: string | null = null;
        try {
          // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
          // but the helper takes the base ProviderDefinition. The generic parameters are
          // erased at runtime — the cast is safe because the concrete type is a supertype.
          const tokenResult = await getActiveTokenForInstallation(
            installation,
            config,
            providerDef as ProviderDefinition
          );
          accessToken = tokenResult.token;
        } catch {
          // If we can't get the token, we can't probe — treat as transient
          await recordTransientFailure(installation);
          return;
        }

        // Call provider health probe
        let status: Awaited<
          ReturnType<NonNullable<typeof providerDef.healthCheck>["check"]>
        >;
        try {
          status = await providerDef.healthCheck!.check(
            config as never,
            installation.externalId,
            accessToken
          );
        } catch {
          // Network error / timeout — treat as transient failure
          await recordTransientFailure(installation);
          return;
        }

        if (status === "healthy") {
          await db
            .update(gatewayInstallations)
            .set({
              healthStatus: "healthy",
              healthCheckFailures: 0,
              lastHealthCheckAt: new Date().toISOString(),
            })
            .where(eq(gatewayInstallations.id, installation.id));

          log.info("[health-check] healthy", {
            installationId: installation.id,
            provider: providerName,
          });
          return;
        }

        // revoked | suspended -> fire lifecycle event immediately
        log.warn("[health-check] auth failure — firing lifecycle", {
          installationId: installation.id,
          provider: providerName,
          status,
        });

        // Write lifecycle log row
        await db.insert(gatewayLifecycleLogs).values({
          id: nanoid(),
          installationId: installation.id,
          event: "health_check_revoked",
          fromStatus: "active",
          toStatus: "revoked",
          reason: `Health check returned "${status}"`,
          metadata: { connectionStatus: status },
        });

        // Fire connectionLifecycle event
        await inngest.send({
          name: "platform/connection.lifecycle",
          data: {
            reason: "health_check_revoked",
            installationId: installation.id,
            orgId: installation.orgId,
            provider: providerName,
            triggeredBy: "health_check",
          },
        });
      });
    }

    return { probed: installations.length };
  }
);

// -- Private helpers --------------------------------------------------------

async function recordTransientFailure(installation: {
  id: string;
  provider: string;
  orgId: string;
  healthCheckFailures: number;
}): Promise<void> {
  const newFailureCount = installation.healthCheckFailures + 1;
  const healthStatus =
    newFailureCount >= FAILURE_THRESHOLD_DEGRADED ? "degraded" : "unknown";

  await db
    .update(gatewayInstallations)
    .set({
      healthCheckFailures: sql`${gatewayInstallations.healthCheckFailures} + 1`,
      healthStatus,
      lastHealthCheckAt: new Date().toISOString(),
    })
    .where(eq(gatewayInstallations.id, installation.id));

  log.warn("[health-check] transient failure recorded", {
    installationId: installation.id,
    provider: installation.provider,
    newFailureCount,
    healthStatus,
  });

  // After FAILURE_THRESHOLD_LIFECYCLE consecutive failures (~30min), fire lifecycle
  if (newFailureCount >= FAILURE_THRESHOLD_LIFECYCLE) {
    await db.insert(gatewayLifecycleLogs).values({
      id: nanoid(),
      installationId: installation.id,
      event: "health_check_unreachable",
      fromStatus: "active",
      toStatus: "revoked",
      reason: `${newFailureCount} consecutive health check failures`,
      metadata: { consecutiveFailures: newFailureCount },
    });

    await inngest.send({
      name: "platform/connection.lifecycle",
      data: {
        reason: "health_check_unreachable",
        installationId: installation.id,
        orgId: installation.orgId,
        provider: installation.provider,
        triggeredBy: "health_check",
      },
    });
  }
}
