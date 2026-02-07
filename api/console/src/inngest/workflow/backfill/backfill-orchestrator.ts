/**
 * Backfill Orchestrator Inngest Workflow
 *
 * Orchestrates a backfill run: validates integration, decrypts tokens,
 * paginates through the connector, dispatches events to the observation
 * pipeline, tracks progress via DB checkpoints, and handles
 * completion/failure/cancellation.
 *
 * Triggered by: apps-console/backfill.requested
 * Cancelled by: apps-console/backfill.cancelled (matched on data.integrationId)
 */
import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { db } from "@db/console/client";
import { workspaceIntegrations, userSources } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { log } from "@vendor/observability/log";
import { decrypt } from "@repo/lib";
import { getConnector } from "@repo/console-backfill";
import type { BackfillConfig, BackfillCheckpoint } from "@repo/console-backfill";
import { env } from "../../../env";
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import { storeIngestionPayload } from "@repo/console-webhooks/storage";
import { updateBackfillState, updateBackfillCheckpoint } from "./backfill-state";

export const backfillOrchestrator = inngest.createFunction(
  {
    id: "apps-console/backfill.orchestrator",
    name: "Backfill Orchestrator",
    retries: 3,
    concurrency: [
      { limit: 1, key: "event.data.integrationId" },
      { limit: 5, key: "event.data.workspaceId" },
    ],
    cancelOn: [
      {
        event: "apps-console/backfill.cancelled",
        match: "data.integrationId",
      },
    ],
    timeouts: { start: "2m", finish: "60m" },
    onFailure: async ({ event, error }) => {
      const data = (event.data.event as unknown as Events["apps-console/backfill.requested"]).data;

      // Check if already cancelled (cancel race condition)
      const integration = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, data.integrationId),
      });

      const currentBackfill = (
        integration?.sourceConfig as Record<string, unknown> | null
      )?.backfill as Record<string, unknown> | undefined;

      if (currentBackfill?.status === "cancelled") {
        log.info("[BackfillOrchestrator] Skipping onFailure — already cancelled", {
          integrationId: data.integrationId,
        });
        return;
      }

      // Merge failure info into existing backfill state (preserve checkpoint)
      await updateBackfillState(data.integrationId, {
        ...(currentBackfill ?? {}),
        status: "failed",
        error: error.message,
        completedAt: new Date().toISOString(),
      } as Parameters<typeof updateBackfillState>[1]);

      log.error("[BackfillOrchestrator] Backfill failed", {
        integrationId: data.integrationId,
        error: error.message,
      });
    },
  },
  { event: "apps-console/backfill.requested" },
  async ({ event, step }) => {
    const {
      integrationId,
      workspaceId,
      clerkOrgId,
      provider,
      userSourceId,
      depth,
      entityTypes,
      requestedBy,
    } = event.data;

    const startTime = Date.now();

    // =========================================================================
    // Step 1: Validate integration
    // =========================================================================
    const integration = await step.run("validate-integration", async () => {
      const result = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, integrationId),
      });

      if (!result) {
        throw new NonRetriableError(`Integration not found: ${integrationId}`);
      }

      if (!result.isActive) {
        throw new NonRetriableError(`Integration is not active: ${integrationId}`);
      }

      return {
        id: result.id,
        sourceConfig: result.sourceConfig as Record<string, unknown>,
      };
    });

    // =========================================================================
    // Step 2: Decrypt access token
    // =========================================================================
    const accessToken = await step.run("decrypt-token", async () => {
      const source = await db.query.userSources.findFirst({
        where: eq(userSources.id, userSourceId),
      });

      if (!source) {
        throw new NonRetriableError(`User source not found: ${userSourceId}`);
      }

      if (!source.accessToken) {
        throw new NonRetriableError(`No access token for source: ${userSourceId}`);
      }

      return decrypt(source.accessToken, env.ENCRYPTION_KEY);
    });

    // =========================================================================
    // Step 3: Get connector and validate scopes
    // =========================================================================
    const connector = getConnector(provider);
    if (!connector) {
      throw new NonRetriableError(`No backfill connector for provider: ${provider}`);
    }

    const since = new Date(Date.now() - depth * 24 * 60 * 60 * 1000).toISOString();

    const config: BackfillConfig = {
      integrationId,
      workspaceId,
      clerkOrgId,
      depth: depth as 7 | 30 | 90,
      since,
      entityTypes,
      sourceConfig: integration.sourceConfig,
      accessToken,
    };

    await step.run("validate-scopes", async () => {
      await connector.validateScopes(config);
    });

    // =========================================================================
    // Step 4: Set backfill status to running
    // =========================================================================
    await step.run("set-backfill-running", async () => {
      await updateBackfillState(integrationId, {
        status: "running",
        startedAt: new Date().toISOString(),
        depth,
        entityTypes,
        requestedBy,
      });
    });

    // =========================================================================
    // Step 5: Create job tracking record
    // =========================================================================
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        workspaceId,
        inngestRunId: event.id ?? `backfill-${integrationId}-${Date.now()}`,
        inngestFunctionId: "backfill.orchestrator",
        name: `Backfill ${provider} (${depth} days)`,
        trigger: "manual",
        triggeredBy: requestedBy,
        input: {
          inngestFunctionId: "backfill.orchestrator" as const,
          integrationId,
          provider,
          depth,
          entityTypes,
        },
      });
    });

    // =========================================================================
    // Step 6: Set job to running
    // =========================================================================
    await step.run("set-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // =========================================================================
    // Step 7: Paginate through each entity type
    // =========================================================================
    let totalEventsProduced = 0;
    let totalEventsDispatched = 0;
    const totalErrors = 0;

    for (const entityType of entityTypes) {
      let cursor: unknown = null;
      let pageNum = 1;

      // Estimate total (if connector supports it)
      if (connector.estimateTotal) {
        await step.run(`estimate-${entityType}`, async () => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by `if (connector.estimateTotal)` above
          const total = await connector.estimateTotal!(config, entityType);
          log.info("[BackfillOrchestrator] Estimated total", {
            entityType,
            total,
            integrationId,
          });
          return total;
        });
      }

      // Pagination loop
      while (true) {
        // Fetch page
        const result = await step.run(
          `fetch-${entityType}-p${pageNum}`,
          async () => {
            const page = await connector.fetchPage(config, entityType, cursor);
            return {
              events: page.events,
              nextCursor: page.nextCursor,
              rawCount: page.rawCount,
              rateLimit: page.rateLimit
                ? {
                    remaining: page.rateLimit.remaining,
                    resetAt: page.rateLimit.resetAt.toISOString(),
                    limit: page.rateLimit.limit,
                  }
                : undefined,
            };
          },
        );

        // Store raw page data for audit trail
        await step.run(
          `store-${entityType}-p${pageNum}`,
          async () => {
            await storeIngestionPayload({
              workspaceId,
              deliveryId: `backfill-${integrationId}-${entityType}-p${pageNum}`,
              source: provider,
              eventType: `backfill.${entityType}`,
              payload: JSON.stringify(result.events),
              headers: {},
              receivedAt: new Date(),
              ingestionSource: "backfill",
            });
          },
        );

        // Dispatch events to observation pipeline (top-level step.sendEvent)
        if (result.events.length > 0) {
          await step.sendEvent(
            `dispatch-${entityType}-p${pageNum}`,
            result.events.map((sourceEvent) => ({
              name: "apps-console/neural/observation.capture" as const,
              data: {
                workspaceId,
                clerkOrgId,
                sourceEvent,
                ingestionSource: "backfill" as const,
              },
            })),
          );

          totalEventsDispatched += result.events.length;
        }

        totalEventsProduced += result.rawCount;

        // Update checkpoint
        const checkpoint: BackfillCheckpoint = {
          currentEntityType: entityType,
          cursor: result.nextCursor,
          eventsProduced: totalEventsProduced,
          eventsDispatched: totalEventsDispatched,
          errors: [],
          updatedAt: new Date().toISOString(),
        };

        await step.run(
          `checkpoint-${entityType}-p${pageNum}`,
          async () => {
            await updateBackfillCheckpoint(integrationId, checkpoint);
          },
        );

        // Rate limit sleep
        if (result.rateLimit) {
          const remaining = result.rateLimit.remaining;
          const limit = result.rateLimit.limit;
          if (remaining < limit * 0.1) {
            const resetAt = new Date(result.rateLimit.resetAt);
            const sleepMs = Math.max(0, resetAt.getTime() - Date.now());
            if (sleepMs > 0) {
              log.info("[BackfillOrchestrator] Rate limit approaching, sleeping", {
                remaining,
                limit,
                sleepMs,
                integrationId,
              });
              await step.sleep(
                `rate-limit-${entityType}-p${pageNum}`,
                `${Math.ceil(sleepMs / 1000)}s`,
              );
            }
          }
        }

        // Check if more pages
        if (!result.nextCursor) {
          break;
        }

        cursor = result.nextCursor;
        pageNum++;
      }
    }

    // =========================================================================
    // Step 8: Set backfill completed
    // =========================================================================
    const durationMs = Date.now() - startTime;

    await step.run("set-backfill-completed", async () => {
      await updateBackfillState(integrationId, {
        status: "completed",
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        depth,
        entityTypes,
        requestedBy,
        eventsProduced: totalEventsProduced,
        eventsDispatched: totalEventsDispatched,
        errorCount: totalErrors,
        durationMs,
        nextAllowedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    });

    // =========================================================================
    // Step 9: Complete job tracking
    // =========================================================================
    await step.run("complete-job", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          inngestFunctionId: "backfill.orchestrator" as const,
          status: "success" as const,
          eventsProduced: totalEventsProduced,
          eventsDispatched: totalEventsDispatched,
          errorCount: totalErrors,
          durationMs,
        },
      });
    });

    // =========================================================================
    // Step 10: Emit backfill.completed event
    // =========================================================================
    await step.sendEvent("backfill-completed", {
      name: "apps-console/backfill.completed",
      data: {
        integrationId,
        workspaceId,
        provider,
        success: true,
        eventsProduced: totalEventsProduced,
        eventsDispatched: totalEventsDispatched,
        errorCount: totalErrors,
        durationMs,
      },
    });

    // =========================================================================
    // Step 11: Record activity for audit log
    // =========================================================================
    await step.sendEvent("record-activity", {
      name: "apps-console/activity.record",
      data: {
        workspaceId,
        actorType: "system",
        category: "integration",
        action: "backfill.completed",
        entityType: "integration",
        entityId: integrationId,
        metadata: {
          provider,
          depth,
          eventsProduced: totalEventsProduced,
          eventsDispatched: totalEventsDispatched,
          durationMs,
        },
        timestamp: new Date().toISOString(),
      },
    });

    log.info("[BackfillOrchestrator] Backfill completed successfully", {
      integrationId,
      workspaceId,
      provider,
      eventsProduced: totalEventsProduced,
      eventsDispatched: totalEventsDispatched,
      durationMs,
    });

    return {
      success: true,
      eventsProduced: totalEventsProduced,
      eventsDispatched: totalEventsDispatched,
      errorCount: totalErrors,
      durationMs,
    };
  },
);
